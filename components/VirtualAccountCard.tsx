'use client';

import { useState } from 'react';
import type { VirtualAccount } from '@/types/database';

interface Props {
  virtualAccount: VirtualAccount | null;
  accountHolderName?: string | null;
}

export function VirtualAccountCard({ virtualAccount, accountHolderName }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!virtualAccount?.account_number) return;
    navigator.clipboard.writeText(virtualAccount.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!virtualAccount || !virtualAccount.account_number) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900">
        <h3 className="font-semibold text-lg text-amber-900">
          Dedicated Account Being Configured
        </h3>
        <p className="text-sm text-amber-700 mt-1">
          Your unique bank transfer account number is being assigned by the payment gateway. Please check back shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Decorative background watermark */}
      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-200 bg-white/10 px-3 py-1 rounded-full">
          Dedicated Savings Account
        </span>
        <span className="text-xs font-medium text-emerald-200/90 capitalize">
          Status: {virtualAccount.assignment_status || 'Active'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
        <div>
          <span className="text-xs text-emerald-200 block">Bank Name</span>
          <span className="text-lg font-bold tracking-tight">{virtualAccount.bank_name}</span>
        </div>

        {accountHolderName && (
          <div>
            <span className="text-xs text-emerald-200 block">Account Holder</span>
            <span className="text-base font-medium truncate block">
              {accountHolderName}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs text-emerald-200 block">Account Number</span>
          <span className="text-2xl sm:text-3xl font-mono font-bold tracking-wider">
            {virtualAccount.account_number}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95 transition px-4 py-2.5 rounded-xl font-medium text-sm shadow flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy Account</span>
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-emerald-200/80 mt-4 italic">
        Transfer directly from any Nigerian bank app to this dedicated account to fund your cooperative savings automatically.
      </p>
    </div>
  );
}