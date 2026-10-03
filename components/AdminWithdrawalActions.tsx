'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminReviewWithdrawalAction } from '@/app/actions/withdrawals';

interface Props {
  requestId: string;
  accountName: string;
  amountFormatted: string;
}

export function AdminWithdrawalActions({ requestId, accountName, amountFormatted }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApprove = () => {
    if (!confirm(`Are you sure you want to approve and execute payout of ${amountFormatted} to ${accountName}?`)) {
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await adminReviewWithdrawalAction({
        requestId,
        decision: 'approved',
      });

      if (res.success) {
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to process payout transfer.');
      }
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await adminReviewWithdrawalAction({
        requestId,
        decision: 'rejected',
        adminNotes: rejectNotes.trim() || 'Request rejected by admin.',
      });

      if (res.success) {
        setShowRejectModal(false);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'Failed to reject request.');
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {errorMsg && (
        <span className="text-xs text-rose-600 max-w-xs truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}

      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
      >
        {isPending ? 'Processing...' : 'Approve & Payout'}
      </button>

      <button
        type="button"
        onClick={() => setShowRejectModal(true)}
        disabled={isPending}
        className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
      >
        Reject
      </button>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-slate-900 text-base">Reject Withdrawal Request</h4>
            <p className="text-xs text-slate-500">
              Provide an administrative note explaining the rejection of {amountFormatted} for {accountName}.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                required
                rows={3}
                placeholder="Reason for rejection (e.g. account name mismatch, KYC required)..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  {isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}