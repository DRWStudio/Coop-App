'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  getSupportedBanks,
  resolveBankAccount,
  createTransferRecipient,
  initiateTransfer,
  type PaystackBank,
} from '@/lib/paystack';
import { nairaToKobo } from '@/types/database';

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 1. Fetch Nigerian Bank List
 */
export async function getBankListAction(): Promise<ActionResult<PaystackBank[]>> {
  try {
    const banks = await getSupportedBanks();
    return { success: true, data: banks };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch bank list.' };
  }
}

/**
 * 2. Resolve NUBAN Bank Account Name
 */
export async function verifyBankAccountAction(
  accountNumber: string,
  bankCode: string
): Promise<ActionResult<{ account_name: string; account_number: string }>> {
  if (!accountNumber || accountNumber.length !== 10 || !bankCode) {
    return { success: false, error: 'Enter a valid 10-digit account number and select a bank.' };
  }

  try {
    const resolved = await resolveBankAccount({ accountNumber, bankCode });
    return {
      success: true,
      data: {
        account_name: resolved.account_name,
        account_number: resolved.account_number,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Could not verify account name. Please check account details.',
    };
  }
}

/**
 * 3. Member Submits Withdrawal with 3-Month Cycle & Non-Refundable Exclusion Guard
 */
export async function requestWithdrawalAction(
  prevState: any,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be logged in to request a withdrawal.' };
  }

  const memberId = user.id;

  // -------------------------------------------------------------
  // GUARD 1: Fixed 3-Month (90-Day) Savings Withdrawal Cycle Check
  // -------------------------------------------------------------
  const { data: lastApprovedWithdrawal } = await supabase
    .from('withdrawal_requests')
    .select('reviewed_at, created_at')
    .eq('member_id', memberId)
    .in('status', ['approved', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const referenceDateStr =
    lastApprovedWithdrawal?.reviewed_at ||
    lastApprovedWithdrawal?.created_at ||
    user.created_at;

  const referenceDate = new Date(referenceDateStr);
  const nextWithdrawalDate = new Date(referenceDate);
  nextWithdrawalDate.setDate(nextWithdrawalDate.getDate() + 90);

  const now = new Date();
  if (now.getTime() < nextWithdrawalDate.getTime()) {
    const daysRemaining = Math.ceil(
      (nextWithdrawalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dateFormatted = nextWithdrawalDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return {
      success: false,
      error: `Withdrawals are locked to a 3-month savings cycle. Next withdrawal unlocks on ${dateFormatted} (${daysRemaining} days remaining).`,
    };
  }

  // -------------------------------------------------------------
  // GUARD 2: Calculate Withdrawable Balance (Exclude Non-Refundables)
  // -------------------------------------------------------------
  const amountNaira = formData.get('amount') as string;
  const destinationBankName = (formData.get('destination_bank_name') as string)?.trim();
  const destinationBankCode = (formData.get('destination_bank_code') as string)?.trim();
  const destinationAccountNumber = (formData.get('destination_account_number') as string)?.trim();
  const destinationAccountName = (formData.get('destination_account_name') as string)?.trim();

  const amountInKobo = nairaToKobo(amountNaira);

  if (amountInKobo <= 0) {
    return { success: false, error: 'Please enter a valid withdrawal amount greater than ₦0.' };
  }

  if (
    !destinationBankName ||
    !destinationBankCode ||
    !destinationAccountNumber ||
    !destinationAccountName
  ) {
    return { success: false, error: 'Please complete and verify bank account details.' };
  }

  // Fetch total balance from member_balances view
  const { data: balanceRecord } = await supabase
    .from('member_balances')
    .select('balance_kobo')
    .eq('member_id', memberId)
    .maybeSingle();

  const totalBalanceInKobo = balanceRecord?.balance_kobo ?? 0;

  // Deduct non-refundable contributions (e.g. Housing) and fees from withdrawable pool
  const { data: nonRefundableEntries } = await supabase
    .from('ledger_entries')
    .select('amount, type, metadata')
    .eq('member_id', memberId)
    .eq('direction', 'credit');

  let nonRefundableKobo = 0;
  for (const entry of nonRefundableEntries || []) {
    const meta = entry.metadata as any;
    if (entry.type === 'fee' || meta?.service === 'housing' || meta?.service === 'registration') {
      nonRefundableKobo += entry.amount;
    }
  }

  // Calculate existing pending withdrawal requests
  const { data: pendingRequests } = await supabase
    .from('withdrawal_requests')
    .select('amount')
    .eq('member_id', memberId)
    .eq('status', 'pending');

  const totalLockedInKobo = (pendingRequests || []).reduce(
    (acc, curr) => acc + curr.amount,
    0
  );

  const withdrawableSavingsKobo = Math.max(
    0,
    totalBalanceInKobo - nonRefundableKobo - totalLockedInKobo
  );

  if (amountInKobo > withdrawableSavingsKobo) {
    return {
      success: false,
      error: `Amount exceeds your withdrawable savings balance (₦${(
        withdrawableSavingsKobo / 100
      ).toLocaleString()}). Note: Housing contributions and registration fees are non-refundable.`,
    };
  }

  // -------------------------------------------------------------
  // Insert Withdrawal Request
  // -------------------------------------------------------------
  const { error: insertError } = await supabase.from('withdrawal_requests').insert({
    member_id: memberId,
    amount: amountInKobo,
    destination_bank_name: destinationBankName,
    destination_bank_code: destinationBankCode,
    destination_account_number: destinationAccountNumber,
    destination_account_name: destinationAccountName,
    status: 'pending',
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath('/withdraw');
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * 4. Admin Approves or Rejects Withdrawal Request
 */
export async function adminReviewWithdrawalAction(params: {
  requestId: string;
  decision: 'approved' | 'rejected';
  adminNotes?: string;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return { success: false, error: 'Forbidden. Admin privileges required.' };
  }

  const adminSupabase = createAdminClient();

  const { data: request, error: fetchErr } = await adminSupabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', params.requestId)
    .single();

  if (fetchErr || !request) {
    return { success: false, error: 'Withdrawal request not found.' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: `Request has already been processed (${request.status}).` };
  }

  const now = new Date().toISOString();

  if (params.decision === 'rejected') {
    const { error: updateErr } = await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: now,
        admin_notes: params.adminNotes || 'Withdrawal request rejected by admin.',
        updated_at: now,
      })
      .eq('id', params.requestId);

    if (updateErr) return { success: false, error: updateErr.message };

    revalidatePath('/admin/withdrawals');
    return { success: true };
  }

  // Approved -> Paystack Transfer
  try {
    const recipient = await createTransferRecipient({
      name: request.destination_account_name,
      accountNumber: request.destination_account_number,
      bankCode: request.destination_bank_code,
    });

    await initiateTransfer({
      amountInKobo: request.amount,
      recipientCode: recipient.recipient_code,
      reason: `Cooperative savings withdrawal - ${request.id.slice(0, 8)}`,
      reference: request.id,
    });

    const { data: ledgerEntry, error: ledgerError } = await adminSupabase
      .from('ledger_entries')
      .insert({
        member_id: request.member_id,
        direction: 'debit',
        amount: request.amount,
        type: 'withdrawal',
        status: 'successful',
        reference: request.id,
        description: `Withdrawal payout to ${request.destination_bank_name} (${request.destination_account_number})`,
        metadata: {
          recipient_code: recipient.recipient_code,
          withdrawal_request_id: request.id,
        },
      })
      .select('id')
      .single();

    if (ledgerError) {
      console.error('Failed to append ledger debit:', ledgerError.message);
    }

    await adminSupabase
      .from('withdrawal_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: now,
        ledger_entry_id: ledgerEntry?.id || null,
        admin_notes: params.adminNotes || 'Approved and payout transfer initiated via Paystack.',
        updated_at: now,
      })
      .eq('id', params.requestId);

    revalidatePath('/admin/withdrawals');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error executing withdrawal payout:', error);
    return {
      success: false,
      error: error.message || 'Payment gateway failed to execute transfer.',
    };
  }
}