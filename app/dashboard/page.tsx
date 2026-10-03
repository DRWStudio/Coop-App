import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VirtualAccountCard } from '@/components/VirtualAccountCard';
import { HousingProgressCard } from '@/components/HousingProgressCard';
import { ContributeModal } from '@/components/ContributeModal';
import { signOutAction } from '@/app/actions/auth';
import {
  formatKoboToNaira,
  formatNaira,
  type VirtualAccount,
  type LedgerEntry,
  type MemberBalance,
} from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch balance directly from the member_balances view
  const { data: memberBalance } = await supabase
    .from('member_balances')
    .select('*')
    .eq('member_id', user.id)
    .maybeSingle();

  // 2. Fetch Assigned Virtual Account
  const { data: virtualAccount } = await supabase
    .from('virtual_accounts')
    .select('*')
    .eq('member_id', user.id)
    .maybeSingle();

  // 3. Fetch Recent Ledger Entries
  const { data: ledgerEntries } = await supabase
    .from('ledger_entries')
    .select('*')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  const allEntries = ledgerEntries || [];

  // 4. Calculate Non-Refundable Housing Contributions
  const housingEntries = allEntries.filter((entry: LedgerEntry) => {
    const meta = entry.metadata as any;
    return (
      meta?.service === 'housing' ||
      entry.description?.toLowerCase().includes('housing')
    );
  });

  const housingContributedKobo = housingEntries.reduce(
    (sum: number, entry: LedgerEntry) => sum + entry.amount,
    0
  );

  // 5. Check Registration Fee Status (Paid vs Pending)
  const isRegistrationPaid =
    memberBalance?.kyc_verified ||
    allEntries.some((entry: LedgerEntry) => {
      const meta = entry.metadata as any;
      return (
        entry.type === 'fee' ||
        meta?.service === 'registration' ||
        entry.description?.toLowerCase().includes('registration')
      );
    });

  // 6. Check 3-Month Withdrawal Cycle Eligibility
  const { data: lastWithdrawal } = await supabase
    .from('withdrawal_requests')
    .select('reviewed_at, created_at')
    .eq('member_id', user.id)
    .in('status', ['approved', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const referenceDateStr =
    lastWithdrawal?.reviewed_at ||
    lastWithdrawal?.created_at ||
    user.created_at;

  const referenceDate = new Date(referenceDateStr);
  const nextWithdrawalDate = new Date(referenceDate);
  nextWithdrawalDate.setDate(nextWithdrawalDate.getDate() + 90);

  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil((nextWithdrawalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
  const isWithdrawalEligible = daysRemaining === 0;

  const balanceNaira = memberBalance?.balance_naira ?? 0;
  const fullName = memberBalance?.full_name || 'Member';
  const role = memberBalance?.role || 'member';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
              C
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight">Cooperative Savings</h1>
              <span className="text-xs text-slate-500">Member Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {role === 'admin' && (
              <Link
                href="/admin/withdrawals"
                className="text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition"
              >
                Admin Panel
              </Link>
            )}

            <span className="hidden sm:inline-block text-sm font-medium text-slate-700">
              {fullName}
            </span>

            <form action={signOutAction}>
              <button
                type="submit"
                className="text-xs font-medium text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Registration Fee Status Banner */}
        {!isRegistrationPaid ? (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-purple-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0 mt-1 sm:mt-0 animate-ping" />
              <div>
                <h4 className="font-bold text-sm text-purple-950">
                  Membership Registration Fee Pending
                </h4>
                <p className="text-xs text-purple-800 mt-0.5">
                  Complete your one-time ₦5,000 non-refundable registration fee to activate full membership rights.
                </p>
              </div>
            </div>

            <ContributeModal
              virtualAccount={virtualAccount}
              defaultService="registration"
              buttonLabel="Pay ₦5,000 Registration Fee"
              buttonClassName="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition shrink-0 cursor-pointer text-center"
            />
          </div>
        ) : (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-4 py-2.5 text-xs text-emerald-900 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              Membership Registration Status: <strong>Active & Verified Member</strong>
            </span>
            <span className="font-bold text-emerald-800">Paid ✓</span>
          </div>
        )}

        {/* Welcome Header with Quick Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {fullName.split(' ')[0]} 👋
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Live cooperative overview for {user.email}
            </p>
          </div>

          {/* Primary Action Buttons: Save/Deposit & Withdraw */}
          <div className="flex flex-wrap items-center gap-3">
            <ContributeModal
              virtualAccount={virtualAccount}
              defaultService="savings"
              buttonLabel="Save / Deposit Funds"
              buttonClassName="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            />

            {isWithdrawalEligible ? (
              <Link
                href="/withdraw"
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition active:scale-95"
              >
                Request Withdrawal
              </Link>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-xs text-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>
                  3-Month Lock: <strong>{daysRemaining}d remaining</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 1: Virtual Account & Withdrawable Balance Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VirtualAccountCard
              virtualAccount={virtualAccount}
              accountHolderName={fullName}
            />
          </div>

          {/* Withdrawable Balance Summary Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Withdrawable Savings Balance
                </span>
                <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  3-Month Cycle
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {formatNaira(balanceNaira)}
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Withdrawal Eligibility</span>
                <span className={`font-semibold ${isWithdrawalEligible ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isWithdrawalEligible ? 'Unlocked (Eligible Now)' : `Locked (${daysRemaining}d left)`}
                </span>
              </div>

              <ContributeModal
                virtualAccount={virtualAccount}
                defaultService="savings"
                buttonLabel="+ Add to Savings"
                buttonClassName="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 rounded-xl text-xs flex items-center justify-center transition cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Non-Refundable Housing Scheme Progress Bar with Direct Contribute Button */}
        <HousingProgressCard
          housingContributedKobo={housingContributedKobo}
          targetGoalKobo={500000000} // ₦5,000,000 target
          planFrequency="monthly"
          installmentAmountKobo={5000000} // ₦50,000/month
          virtualAccount={virtualAccount}
        />

        {/* Section 3: Append-Only Savings Ledger Activity Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Savings & Contribution Ledger</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Append-only financial records for savings, housing contributions, and fees.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {allEntries.length} entries shown
            </span>
          </div>

          {allEntries.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h4 className="font-medium text-slate-800">No transactions recorded yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click &ldquo;Save / Deposit Funds&rdquo; or transfer money to your dedicated account number above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Date & Time</th>
                    <th className="px-6 py-3.5">Direction</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Description / Service</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allEntries.map((entry: LedgerEntry) => {
                    const isCredit = entry.direction === 'credit';
                    const meta = entry.metadata as any;
                    const isHousing = meta?.service === 'housing';
                    const isRegistration = meta?.service === 'registration' || entry.type === 'fee';

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/75 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(entry.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              isCredit
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {entry.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize text-xs font-medium text-slate-700">
                          {entry.type}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                            {entry.description || 'Contribution'}
                            {isHousing && (
                              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                                Housing
                              </span>
                            )}
                            {isRegistration && (
                              <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-semibold">
                                Registration
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-400 truncate max-w-xs">
                            Ref: {entry.reference}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                              entry.status === 'successful'
                                ? 'bg-emerald-50 text-emerald-700'
                                : entry.status === 'failed'
                                ? 'bg-rose-50 text-rose-700'
                                : entry.status === 'reversed'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-right font-semibold text-sm ${
                            isCredit ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatKoboToNaira(entry.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}