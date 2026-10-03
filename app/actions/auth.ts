'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  createPaystackCustomer,
  assignDedicatedVirtualAccount,
} from '@/lib/paystack';

export interface AuthActionResult {
  success?: boolean;
  error?: string;
}

/**
 * 1. Sign Up Action: Registers member with Supabase Auth, initializes profile,
 * and provisions Paystack Dedicated NUBAN Virtual Account.
 */
export async function signUpAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const fullName = (formData.get('full_name') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim() || null;

  if (!email || !password || !fullName) {
    return { error: 'Please provide your full name, email, and a secure password.' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters long.' };
  }

  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // Step A: Register user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
      },
    },
  });

  if (authError || !authData.user) {
    return { error: authError?.message || 'Failed to create member account.' };
  }

  const memberId = authData.user.id;

  // Step B: Insert into profiles (STRICT: NO email column in profiles table)
  const { error: profileError } = await adminSupabase
    .from('profiles')
    .upsert({
      id: memberId,
      full_name: fullName,
      phone: phone,
      role: 'member',
      kyc_verified: false,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    console.error('Error upserting member profile:', profileError.message);
  }

  // Step C: Provision Paystack Customer & Dedicated Virtual Account
  try {
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Member';
    const lastName = nameParts.slice(1).join(' ') || 'Cooperative';

    // 1. Create Paystack customer
    const paystackCustomer = await createPaystackCustomer({
      email,
      firstName,
      lastName,
      phone: phone || undefined,
    });

    const customerCode = paystackCustomer.customer_code;

    // 2. Request dedicated virtual account (NUBAN)
    const dva = await assignDedicatedVirtualAccount({
      customerCode,
    });

    if (dva && dva.account_number) {
      // Step D: Insert into virtual_accounts using member_id (NOT user_id)
      await adminSupabase.from('virtual_accounts').upsert({
        member_id: memberId,
        account_number: dva.account_number,
        bank_name: dva.bank.name,
        paystack_customer_code: customerCode,
        paystack_account_reference: dva.assignment?.assigned_at || String(dva.assignment?.integration || customerCode),
        assignment_status: dva.assigned ? 'assigned' : 'pending',
        updated_at: new Date().toISOString(),
      });
    }
  } catch (paystackErr: any) {
    console.error('Virtual account provisioning error during registration:', paystackErr.message);
    // Non-blocking: Account can be provisioned upon first dashboard visit
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/**
 * 2. Sign In Action
 */
export async function signInAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please enter both your email address and password.' };
  }

  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

/**
 * 3. Sign Out Action
 */
export async function signOutAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * 4. Self-Healing Action: Ensures member has an active virtual account assigned.
 */
export async function ensureVirtualAccountAction(): Promise<{
  success: boolean;
  message?: string;
  account?: any;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Unauthorized' };
  }

  const adminSupabase = createAdminClient();

  // 1. Check if virtual account already exists for member_id
  const { data: existingAccount } = await adminSupabase
    .from('virtual_accounts')
    .select('*')
    .eq('member_id', user.id)
    .maybeSingle();

  if (existingAccount) {
    return { success: true, account: existingAccount };
  }

  // 2. Fetch member profile for name & phone (email retrieved from user auth object)
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single();

  const userEmail = user.email;
  if (!userEmail) {
    return { success: false, message: 'User email not found in auth object' };
  }

  try {
    const fullName = profile?.full_name || 'Member';
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Member';
    const lastName = nameParts.slice(1).join(' ') || 'Cooperative';

    const customer = await createPaystackCustomer({
      email: userEmail,
      firstName,
      lastName,
      phone: profile?.phone || undefined,
    });

    const customerCode = customer.customer_code;
    const dva = await assignDedicatedVirtualAccount({ customerCode });

    if (dva && dva.account_number) {
      const { data: savedAccount, error: saveErr } = await adminSupabase
        .from('virtual_accounts')
        .insert({
          member_id: user.id,
          account_number: dva.account_number,
          bank_name: dva.bank.name,
          paystack_customer_code: customerCode,
          paystack_account_reference: dva.assignment?.assigned_at || String(customerCode),
          assignment_status: dva.assigned ? 'assigned' : 'pending',
        })
        .select('*')
        .single();

      if (saveErr) throw saveErr;

      revalidatePath('/dashboard');
      return { success: true, account: savedAccount };
    }

    return {
      success: false,
      message: 'Could not obtain account number from payment gateway.',
    };
  } catch (err: any) {
    console.error('Failed to ensure virtual account:', err.message);
    return { success: false, message: err.message };
  }
}