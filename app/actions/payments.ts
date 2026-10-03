'use server';

import { createClient } from '@/lib/supabase/server';
import { nairaToKobo } from '@/types/database';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface InitializePaymentResult {
  success: boolean;
  authorizationUrl?: string;
  reference?: string;
  error?: string;
}

export async function initializeContributionAction(params: {
  amountNaira: number;
  service: 'savings' | 'housing' | 'registration';
  redirectUrl?: string;
}): Promise<InitializePaymentResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { success: false, error: 'You must be signed in to make a contribution.' };
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return { success: false, error: 'Payment gateway configuration missing on server.' };
  }

  const amountInKobo = nairaToKobo(params.amountNaira);
  if (amountInKobo <= 0) {
    return { success: false, error: 'Please enter a valid amount.' };
  }

  const reference = `COOP-${params.service.toUpperCase()}-${user.id.slice(0, 6)}-${Date.now()}`;

  const descriptionMap = {
    savings: 'Voluntary Cooperative Savings Contribution',
    housing: 'Non-Refundable Cooperative Housing Scheme Contribution',
    registration: 'One-Time Cooperative Membership Registration Fee',
  };

  try {
    const callbackUrl =
      params.redirectUrl ||
      `${process.env.APP_URL || 'http://localhost:3000'}/dashboard?status=success`;

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountInKobo,
        reference,
        callback_url: callbackUrl,
        metadata: {
          member_id: user.id,
          service: params.service,
          description: descriptionMap[params.service],
          custom_fields: [
            {
              display_name: 'Contribution Service',
              variable_name: 'service',
              value: params.service,
            },
          ],
        },
      }),
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return {
        success: false,
        error: data.message || 'Failed to initialize payment gateway session.',
      };
    }

    return {
      success: true,
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    };
  } catch (err: any) {
    console.error('Error initializing Paystack transaction:', err);
    return { success: false, error: err.message || 'Network error occurred.' };
  }
}