import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPaystackSignature } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!verifyPaystackSignature(rawBody, signature)) {
    console.error('Invalid Paystack webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType: string = payload.event;
  const eventData = payload.data ?? {};
  const supabase = createAdminClient();

  // Best-effort audit log. Not used as the idempotency gate -- the unique
  // `reference` constraints on ledger_entries (below) do that job reliably,
  // even across retries that happen before this logging call completes.
  const eventId = `${eventType}:${eventData.id ?? eventData.reference ?? eventData.transfer_code ?? 'unknown'}`;
  await supabase
    .from('webhook_events')
    .insert({ event_id: eventId, event_type: eventType, payload })
    .then(() => {}, () => {}); // ignore duplicate-key or logging errors; never block processing on this

  try {
    switch (eventType) {
      // ----------------------------------------------------------------
      // A member funded their dedicated virtual account.
      // ----------------------------------------------------------------
      case 'charge.success': {
        const reference = eventData.reference as string | undefined;
        const amount = Math.round(Number(eventData.amount));

        if (!reference || !Number.isFinite(amount) || amount <= 0) {
          console.warn('Malformed charge.success payload', { reference, amount });
          break;
        }

        const accountNumber = eventData.authorization?.receiver_bank_account_number as string | undefined;
        const customerCode = eventData.customer?.customer_code as string | undefined;

        let memberId: string | null = null;

        if (accountNumber) {
          const { data } = await supabase
            .from('virtual_accounts')
            .select('member_id')
            .eq('account_number', accountNumber)
            .maybeSingle();
          memberId = data?.member_id ?? null;
        }

        if (!memberId && customerCode) {
          const { data } = await supabase
            .from('virtual_accounts')
            .select('member_id')
            .eq('paystack_customer_code', customerCode)
            .maybeSingle();
          memberId = data?.member_id ?? null;
        }

        if (!memberId) {
          console.error('charge.success: could not map payment to a member', {
            reference,
            accountNumber,
            customerCode,
          });
          break;
        }

        // The ledger's UNIQUE constraint on `reference` is the real
        // idempotency guard here: a retried webhook for the same payment
        // hits a duplicate-key error (code 23505) and is safely ignored.
        const { error: ledgerError } = await supabase.from('ledger_entries').insert({
          member_id: memberId,
          direction: 'credit',
          amount,
          type: 'contribution',
          status: 'successful',
          reference,
          description: `Deposit via ${eventData.channel ?? 'bank transfer'}`,
        });

        if (ledgerError && ledgerError.code !== '23505') {
          throw ledgerError;
        }
        break;
      }

      // ----------------------------------------------------------------
      // A withdrawal payout was confirmed. We use the withdrawal request's
      // own id as the Paystack transfer `reference` (set when the admin
      // approved it), so no separate transfer-code column is needed.
      // ----------------------------------------------------------------
      case 'transfer.success': {
        const withdrawalId = eventData.reference as string | undefined;
        const amount = Math.round(Number(eventData.amount));
        if (!withdrawalId) break;

        const { data: withdrawal } = await supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('id', withdrawalId)
          .maybeSingle();

        if (!withdrawal || withdrawal.status === 'paid') break; // unknown, or already handled

        // Debit happens here, on confirmed payout -- not at approval time.
        // That way a failed transfer never needs a refund: no debit was
        // ever posted if it didn't succeed.
        const { data: entry, error: ledgerError } = await supabase
          .from('ledger_entries')
          .insert({
            member_id: withdrawal.member_id,
            direction: 'debit',
            amount: amount || withdrawal.amount,
            type: 'withdrawal',
            status: 'successful',
            reference: `withdrawal-${withdrawal.id}`,
          })
          .select('id')
          .single();

        if (ledgerError && ledgerError.code !== '23505') throw ledgerError;

        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'paid',
            ledger_entry_id: entry?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', withdrawal.id);

        break;
      }

      // ----------------------------------------------------------------
      // A payout failed or was reversed by Paystack. Since nothing was
      // debited until transfer.success (above), there's nothing to
      // refund -- we just mark the request so the member can retry.
      // ----------------------------------------------------------------
      case 'transfer.failed':
      case 'transfer.reversed': {
        const withdrawalId = eventData.reference as string | undefined;
        if (!withdrawalId) break;

        await supabase
          .from('withdrawal_requests')
          .update({
            status: 'rejected',
            admin_notes: `Paystack reported: ${eventData.reason ?? eventType}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', withdrawalId)
          .neq('status', 'rejected'); // no-op if already handled by an earlier delivery

        break;
      }

      default:
        console.log(`Unhandled Paystack event: ${eventType}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing Paystack webhook:', error);
    // 500 tells Paystack to retry. Safe to retry: every write above is
    // guarded by a unique constraint or an idempotent status update.
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}
