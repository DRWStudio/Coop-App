export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'member' | 'admin';

export type LedgerDirection = 'credit' | 'debit';

export type LedgerEntryType =
  | 'contribution'
  | 'withdrawal'
  | 'fee'
  | 'interest'
  | 'refund'
  | 'adjustment';

export type LedgerStatus = 'pending' | 'successful' | 'failed' | 'reversed';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; // auth.users.id
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          kyc_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          kyc_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          kyc_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      virtual_accounts: {
        Row: {
          id: string;
          member_id: string; // references profiles.id
          account_number: string;
          bank_name: string;
          paystack_customer_code: string | null;
          paystack_account_reference: string | null;
          assignment_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          account_number: string;
          bank_name: string;
          paystack_customer_code?: string | null;
          paystack_account_reference?: string | null;
          assignment_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          account_number?: string;
          bank_name?: string;
          paystack_customer_code?: string | null;
          paystack_account_reference?: string | null;
          assignment_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      ledger_entries: {
        Row: {
          id: string;
          member_id: string; // references profiles.id
          direction: LedgerDirection;
          amount: number; // bigint in kobo (stored as number in TS)
          type: LedgerEntryType;
          status: LedgerStatus;
          reference: string; // unique text
          description: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          direction: LedgerDirection;
          amount: number;
          type: LedgerEntryType;
          status?: LedgerStatus;
          reference: string;
          description?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        // NOTE: ledger_entries is append-only. Never update or delete rows.
        Update: {
          id?: never;
          member_id?: never;
          direction?: never;
          amount?: never;
          type?: never;
          status?: never;
          reference?: never;
          description?: never;
          metadata?: never;
          created_at?: never;
        };
      };
      withdrawal_requests: {
        Row: {
          id: string;
          member_id: string; // references profiles.id
          amount: number; // bigint in kobo
          destination_bank_name: string;
          destination_bank_code: string;
          destination_account_number: string;
          destination_account_name: string;
          status: WithdrawalStatus;
          admin_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          ledger_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          amount: number;
          destination_bank_name: string;
          destination_bank_code: string;
          destination_account_number: string;
          destination_account_name: string;
          status?: WithdrawalStatus;
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          ledger_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          amount?: number;
          destination_bank_name?: string;
          destination_bank_code?: string;
          destination_account_number?: string;
          destination_account_name?: string;
          status?: WithdrawalStatus;
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          ledger_entry_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      webhook_events: {
        Row: {
          event_id: string; // primary key
          event_type: string;
          payload: Json;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          payload?: Json;
          processed_at?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      member_balances: {
        Row: {
          member_id: string;
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          kyc_verified: boolean;
          balance_kobo: number;
          balance_naira: number;
          transaction_count: number;
        };
      };
    };
  };
}

// Convenience Model Types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type VirtualAccount = Database['public']['Tables']['virtual_accounts']['Row'];
export type LedgerEntry = Database['public']['Tables']['ledger_entries']['Row'];
export type WithdrawalRequest = Database['public']['Tables']['withdrawal_requests']['Row'];
export type WebhookEvent = Database['public']['Tables']['webhook_events']['Row'];
export type MemberBalance = Database['public']['Views']['member_balances']['Row'];

/**
 * Currency Utility: Convert Kobo to Naira
 */
export function koboToNaira(kobo: number): number {
  return (kobo || 0) / 100;
}

/**
 * Currency Utility: Convert Naira input to integer Kobo
 */
export function nairaToKobo(naira: number | string): number {
  const numeric = typeof naira === 'string' ? parseFloat(naira) : naira;
  if (isNaN(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
}

/**
 * Currency Utility: Format Kobo integer into Nigerian Naira string (e.g. 250000 -> "₦2,500.00")
 */
export function formatKoboToNaira(kobo: number, includeSymbol: boolean = true): string {
  const naira = koboToNaira(kobo);
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);

  return includeSymbol ? `₦${formatted}` : formatted;
}

/**
 * Currency Utility: Format Naira number directly
 */
export function formatNaira(naira: number, includeSymbol: boolean = true): string {
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira || 0);

  return includeSymbol ? `₦${formatted}` : formatted;
}