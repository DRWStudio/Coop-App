import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBankListAction } from '@/app/actions/withdrawals';
import { WithdrawalForm } from '@/components/WithdrawalForm';
import { formatKoboToNaira, type WithdrawalRequest } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function WithdrawalPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch live balance from member_balances view
  const { data: balanceRecord } = await supabase
    .from('member_balances')
    .select('balance_kobo')
    .eq('member_id', user.id)
    .maybeSingle();

  const totalBalanceKobo = balanceRecord?.balance_kobo ?? 0;

  // 2. Deduct non-refundable contributions (Housing, Registration)
  const { data: nonRefundableEntries } = await supabase
    .from('ledger_entries')
    .select('amount, type, metadata')
    .eq('member_id', user.id)
    .eq('direction', 'credit');

  let nonRefundableKobo = 0;
  for (const entry of nonRefundableEntries || []) {
    const meta = entry.metadata as any;
    if (entry.type === 'fee' || meta?.service === 'housing' || meta?.service === 'registration') {
      nonRefundableKobo += entry.amount;
    }
  }

  // 3. Deduct active pending withdrawal requests
  const { data: pendingRequests } = await supabase
    .from('withdrawal_requests')
    .select('amount')
    .eq('member_id', user.id)
    .eq('status', 'pending');

  const lockedAmountKobo = (pendingRequests || []).reduce(
    (acc, curr) => acc + curr.amount,
    0
  );

  const withdrawableBalanceKobo = Math.max(
    0,
    totalBalanceKobo - nonRefundableKobo - lockedAmountKobo
  );

  // 4. Calculate 3-Month Cycle Status
  const { data: lastApprovedWithdrawal } = await supabase
    .from('withdrawal_requests')
    .select('reviewed_at, created_at')
    .eq('member_id', user.id)
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
  const daysRemaining = Math.max(
    0,
    Math.ceil((nextWithdrawalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
  const isEligible = daysRemaining === 0;

  // 5. Fetch banks list
  const banksResult = await getBankListAction();
  const banks = banksResult.success && banksResult.data ? banksResult.data : [];

  // 6. Fetch past withdrawal requests
  const { data: pastRequests } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-600 hover:text-emerald-700 flex items-center gap-1.5 transition"
          >
            ← Back to Member Dashboard
          </Link>
          <span className="text-xs text-slate-400 font-mono">Withdrawal Portal</span>
        </div>

        {/* 3-Month Cycle Status Banner */}
        {!isEligible ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="font-bold text-base text-amber-950">
                3-Month Savings Cycle Lock Active
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
              In accordance with cooperative bylaws, member savings are locked in fixed 3-month withdrawal cycles to ensure liquidity and investment maturity. Your next withdrawal window opens on{' '}
              <strong>
                {nextWithdrawalDate.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>{' '}
              (<strong>{daysRemaining} days remaining</strong>).
            </p>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Your 3-month savings cycle has matured. You are eligible to submit a withdrawal request.
            </span>
            <span className="font-semibold text-emerald-800">Cycle Open ✓</span>
          </div>
        )}

        {/* Withdrawal Form (Only active if eligible) */}
        {isEligible ? (
          <WithdrawalForm
            availableBalanceKobo={withdrawableBalanceKobo}
            banks={banks}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl">
              ⏳
            </div>
            <h4 className="font-bold text-slate-800 text-base">Withdrawal Form Currently Locked</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You will be able to input your destination bank details as soon as your 3-month savings cycle matures on{' '}
              {nextWithdrawalDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition mt-2"
            >
              Return to Dashboard
            </Link>
          </div>
        )}

        {/* Past Withdrawal Requests History */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="font-bold text-lg text-slate-900">Your Withdrawal History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Audit trail of all your payout requests and administrative reviews.
            </p>
          </div>

          {!pastRequests || pastRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              You have not submitted any withdrawal requests yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Destination Bank</th>
                    <th className="px-6 py-3.5">Amount</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pastRequests.map((req: WithdrawalRequest) => {
                    const statusColors: Record<string, string> = {
                      pending: 'bg-amber-50 text-amber-700 border-amber-200',
                      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
                    };

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/75 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(req.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 text-xs sm:text-sm">
                            {req.destination_bank_name}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {req.destination_account_number} • {req.destination_account_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900 text-sm">
                          {formatKoboToNaira(req.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
                              statusColors[req.status] || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                          {req.admin_notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}