'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyBankAccountAction, requestWithdrawalAction } from '@/app/actions/withdrawals';
import type { PaystackBank } from '@/lib/paystack';
import { formatKoboToNaira, koboToNaira } from '@/types/database';

interface Props {
  availableBalanceKobo: number;
  banks: PaystackBank[];
}

export function WithdrawalForm({ availableBalanceKobo, banks }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [amountNaira, setAmountNaira] = useState('');
  const [destinationBankCode, setDestinationBankCode] = useState('');
  const [destinationBankName, setDestinationBankName] = useState('');
  const [destinationAccountNumber, setDestinationAccountNumber] = useState('');

  // Resolution state
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Bank selection
  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setDestinationBankCode(code);
    const selected = banks.find((b) => b.code === code);
    setDestinationBankName(selected?.name || '');
    setResolvedAccountName(null);
    setResolveError(null);

    if (destinationAccountNumber.length === 10 && code) {
      triggerVerification(destinationAccountNumber, code);
    }
  };

  // Account number
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setDestinationAccountNumber(val);
    setResolvedAccountName(null);
    setResolveError(null);

    if (val.length === 10 && destinationBankCode) {
      triggerVerification(val, destinationBankCode);
    }
  };

  const triggerVerification = async (accNum: string, bCode: string) => {
    setIsResolving(true);
    setResolveError(null);
    setResolvedAccountName(null);

    const result = await verifyBankAccountAction(accNum, bCode);
    setIsResolving(false);

    if (result.success && result.data) {
      setResolvedAccountName(result.data.account_name);
    } else {
      setResolveError(result.error || 'Could not verify account name.');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    const numericAmount = parseFloat(amountNaira);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setSubmitError('Please enter a valid amount.');
      return;
    }

    if (numericAmount * 100 > availableBalanceKobo) {
      setSubmitError('Amount exceeds your available savings balance.');
      return;
    }

    if (!resolvedAccountName) {
      setSubmitError('Please verify your destination account details before submitting.');
      return;
    }

    const formData = new FormData();
    formData.append('amount', amountNaira);
    formData.append('destination_bank_name', destinationBankName);
    formData.append('destination_bank_code', destinationBankCode);
    formData.append('destination_account_number', destinationAccountNumber);
    formData.append('destination_account_name', resolvedAccountName);

    startTransition(async () => {
      const res = await requestWithdrawalAction(null, formData);
      if (res.success) {
        setSubmitSuccess(true);
        setAmountNaira('');
        setDestinationAccountNumber('');
        setResolvedAccountName(null);
        router.refresh();
      } else {
        setSubmitError(res.error || 'Failed to submit withdrawal request.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Request Withdrawal</h3>
          <p className="text-xs text-slate-500">Funds are transferred to your verified Nigerian bank account.</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 block uppercase">Available to Withdraw</span>
          <span className="text-sm font-bold text-emerald-600">{formatKoboToNaira(availableBalanceKobo)}</span>
        </div>
      </div>

      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Withdrawal request submitted! An administrator will review and process your transfer.</span>
        </div>
      )}

      {submitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
          {submitError}
        </div>
      )}

      {/* Amount Input */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
          Amount to Withdraw (₦)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-3 text-slate-400 font-bold">₦</span>
          <input
            type="number"
            min="100"
            step="100"
            required
            placeholder="5000"
            value={amountNaira}
            onChange={(e) => setAmountNaira(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setAmountNaira(koboToNaira(availableBalanceKobo).toString())}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1 inline-block cursor-pointer"
        >
          Withdraw entire available balance
        </button>
      </div>

      {/* Destination Bank Dropdown */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
          Destination Bank
        </label>
        <select
          required
          value={destinationBankCode}
          onChange={handleBankChange}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-sm bg-white"
        >
          <option value="">Select recipient bank...</option>
          {banks.map((b) => (
            <option key={b.id} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Destination Account Number */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
          10-Digit NUBAN Account Number
        </label>
        <input
          type="text"
          maxLength={10}
          required
          placeholder="0123456789"
          value={destinationAccountNumber}
          onChange={handleAccountChange}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900 text-sm"
        />

        {/* Verification Status */}
        {isResolving && (
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Resolving account details with Paystack...
          </p>
        )}

        {resolvedAccountName && (
          <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-700 block font-medium">Verified Account Name:</span>
              <span className="text-sm font-bold text-emerald-950 uppercase">{resolvedAccountName}</span>
            </div>
            <span className="text-xs font-semibold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded">
              Verified ✓
            </span>
          </div>
        )}

        {resolveError && (
          <p className="text-xs text-rose-600 font-medium mt-1.5">{resolveError}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || !resolvedAccountName || isResolving}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl shadow transition cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? 'Submitting Request...' : 'Submit Withdrawal Request'}
      </button>
    </form>
  );
}