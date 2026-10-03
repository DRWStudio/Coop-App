'use client';

import { useState, useTransition } from 'react';
import { initializeContributionAction } from '@/app/actions/payments';
import type { VirtualAccount } from '@/types/database';

interface Props {
  virtualAccount: VirtualAccount | null;
  defaultService?: 'savings' | 'housing' | 'registration';
  buttonLabel?: string;
  buttonClassName?: string;
}

export function ContributeModal({
  virtualAccount,
  defaultService = 'savings',
  buttonLabel = 'Save / Contribute',
  buttonClassName,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [service, setService] = useState<'savings' | 'housing' | 'registration'>(defaultService);
  const [amountNaira, setAmountNaira] = useState(defaultService === 'registration' ? '5000' : '10000');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'transfer'>('online');
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpen = (svc?: 'savings' | 'housing' | 'registration') => {
    if (svc) {
      setService(svc);
      if (svc === 'registration') setAmountNaira('5000');
    }
    setErrorMsg(null);
    setIsOpen(true);
  };

  const handleCopyAccount = () => {
    if (!virtualAccount?.account_number) return;
    navigator.clipboard.writeText(virtualAccount.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOnlinePay = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericAmount = parseFloat(amountNaira);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    startTransition(async () => {
      const res = await initializeContributionAction({
        amountNaira: numericAmount,
        service,
      });

      if (res.success && res.authorizationUrl) {
        // Redirect to Paystack secure checkout
        window.location.href = res.authorizationUrl;
      } else {
        setErrorMsg(res.error || 'Failed to initialize payment gateway.');
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpen(defaultService)}
        className={
          buttonClassName ||
          'bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5'
        }
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative my-8">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900">Make a Contribution</h3>
              <p className="text-xs text-slate-500 mt-1">
                Choose the cooperative service you wish to fund.
              </p>
            </div>

            {/* Step 1: Select Service */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                1. Select Service / Purpose
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                {/* Option A: Voluntary Savings */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between ${
                    service === 'savings'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="service"
                      checked={service === 'savings'}
                      onChange={() => setService('savings')}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Regular Savings</span>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          Withdrawable (3-Mo Cycle)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Build your general savings capital. Withdrawable every 3 months.
                      </p>
                    </div>
                  </div>
                </label>

                {/* Option B: Housing Scheme */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between ${
                    service === 'housing'
                      ? 'border-amber-600 bg-amber-50/50 ring-1 ring-amber-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="service"
                      checked={service === 'housing'}
                      onChange={() => setService('housing')}
                      className="mt-1 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Housing Scheme</span>
                        <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                          Non-Refundable
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Contributions allocated directly to estate land and building development.
                      </p>
                    </div>
                  </div>
                </label>

                {/* Option C: Registration Fee */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between ${
                    service === 'registration'
                      ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="service"
                      checked={service === 'registration'}
                      onChange={() => {
                        setService('registration');
                        setAmountNaira('5000');
                      }}
                      className="mt-1 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Membership Registration</span>
                        <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          One-Time ₦5,000
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Required one-time onboarding and cooperative membership fee.
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Step 2: Payment Method Tabs */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                2. Choose Payment Method
              </label>

              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    paymentMethod === 'online'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  💳 Pay Online (Card / USSD)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    paymentMethod === 'transfer'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🏦 Dedicated Bank Transfer
                </button>
              </div>
            </div>

            {/* Option 1 View: Instant Online Payment Form */}
            {paymentMethod === 'online' && (
              <form onSubmit={handleOnlinePay} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Amount to Pay (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₦</span>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      required
                      value={amountNaira}
                      disabled={service === 'registration'}
                      onChange={(e) => setAmountNaira(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-sm disabled:bg-slate-100"
                    />
                  </div>

                  {service !== 'registration' && (
                    <div className="flex gap-2 mt-2">
                      {['2000', '5000', '10000', '50000'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmountNaira(preset)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          ₦{parseInt(preset).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl shadow-md transition text-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  {isPending
                    ? 'Connecting to Payment Gateway...'
                    : `Proceed to Pay ₦${parseFloat(amountNaira || '0').toLocaleString()} Online`}
                </button>
              </form>
            )}

            {/* Option 2 View: Dedicated Virtual Account Transfer */}
            {paymentMethod === 'transfer' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500">Your Dedicated Deposit Account:</span>
                  <div className="text-2xl font-mono font-bold text-slate-900 tracking-wider">
                    {virtualAccount?.account_number || 'Pending Assignment'}
                  </div>
                  <div className="text-xs text-slate-600">
                    Bank: <strong>{virtualAccount?.bank_name || 'Assigned Bank'}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className="w-full bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? '✓ Account Number Copied!' : 'Copy Account Number'}
                </button>

                <p className="text-[11px] text-slate-500 leading-relaxed italic border-t border-slate-200 pt-3">
                  Transfer any amount from your banking app directly to your account number above. Deposits are credited within seconds via automated webhook.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}