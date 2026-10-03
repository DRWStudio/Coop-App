import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not defined in server environment variables.');
  }
  return key;
}

/**
 * Generic internal fetch wrapper for Paystack API calls.
 */
async function paystackRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const secretKey = getPaystackSecretKey();

  const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || `Paystack request to ${endpoint} failed`);
  }

  return data.data as T;
}

/**
 * 1. Verify Paystack Webhook Cryptographic Signature (HMAC SHA512).
 * Strictly prevents fraudulent or unauthenticated webhook payloads.
 */
export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = getPaystackSecretKey();

  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  return hash === signature;
}

/**
 * 2. Create or Retrieve a Customer on Paystack.
 */
export interface PaystackCustomerResponse {
  id: number;
  customer_code: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export async function createPaystackCustomer(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<PaystackCustomerResponse> {
  return paystackRequest<PaystackCustomerResponse>('/customer', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      phone: params.phone || undefined,
    }),
  });
}

/**
 * 3. Assign Dedicated NUBAN / Virtual Account to a customer.
 * Uses PAYSTACK_PREFERRED_BANK from environment if not explicitly provided.
 */
export interface DedicatedAccountResponse {
  bank: {
    name: string;
    id: number;
    slug: string;
  };
  account_name: string;
  account_number: string;
  assigned: boolean;
  currency: string;
  customer: {
    id: number;
    customer_code: string;
    email: string;
  };
  assignment: {
    integration: number;
    assignee_id: number;
    assigned_at: string;
  };
}

export async function assignDedicatedVirtualAccount(params: {
  customerCode: string;
  preferredBank?: string;
}): Promise<DedicatedAccountResponse> {
  const preferredBank =
    params.preferredBank || process.env.PAYSTACK_PREFERRED_BANK || 'wema-bank';

  return paystackRequest<DedicatedAccountResponse>('/dedicated_account', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerCode,
      preferred_bank: preferredBank,
    }),
  });
}

/**
 * 4. List all supported Nigerian Banks for withdrawals.
 */
export interface PaystackBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  active: boolean;
  currency: string;
}

export async function getSupportedBanks(): Promise<PaystackBank[]> {
  return paystackRequest<PaystackBank[]>('/bank?country=nigeria&currency=NGN', {
    method: 'GET',
    headers: {
      // Banks list can be cached for an hour
      'Cache-Control': 'max-age=3600',
    },
  });
}

/**
 * 5. Resolve Nigerian NUBAN Bank Account Name.
 * Verifies that the member's account number and bank code match.
 */
export interface ResolvedAccountResponse {
  account_number: string;
  account_name: string;
  bank_id: number;
}

export async function resolveBankAccount(params: {
  accountNumber: string;
  bankCode: string;
}): Promise<ResolvedAccountResponse> {
  return paystackRequest<ResolvedAccountResponse>(
    `/bank/resolve?account_number=${encodeURIComponent(
      params.accountNumber
    )}&bank_code=${encodeURIComponent(params.bankCode)}`,
    {
      method: 'GET',
    }
  );
}

/**
 * 6. Create a Transfer Recipient for payouts/withdrawals.
 */
export interface TransferRecipientResponse {
  recipient_code: string;
  active: boolean;
  name: string;
  details: {
    account_number: string;
    account_name: string;
    bank_code: string;
    bank_name: string;
  };
}

export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<TransferRecipientResponse> {
  return paystackRequest<TransferRecipientResponse>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: 'NGN',
    }),
  });
}

/**
 * 7. Initiate a Transfer (Payout) in Kobo.
 */
export interface TransferResponse {
  reference: string;
  integration: number;
  amount: number; // in kobo
  transfer_code: string;
  status: string;
}

export async function initiateTransfer(params: {
  amountInKobo: number;
  recipientCode: string;
  reason: string;
  reference: string;
}): Promise<TransferResponse> {
  return paystackRequest<TransferResponse>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: params.amountInKobo,
      recipient: params.recipientCode,
      reason: params.reason,
      reference: params.reference,
    }),
  });
}

/**
 * 8. Verify a Transaction Reference (used for manual reconciliation if needed).
 */
export interface VerifyTransactionResponse {
  id: number;
  status: string;
  reference: string;
  amount: number; // in kobo
  gateway_response: string;
  customer: {
    id: number;
    customer_code: string;
    email: string;
  };
}

export async function verifyTransaction(
  reference: string
): Promise<VerifyTransactionResponse> {
  return paystackRequest<VerifyTransactionResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET',
    }
  );
}