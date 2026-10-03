import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AdminWithdrawalActions } from '@/components/AdminWithdrawalActions';
import { formatKoboToNaira, type WithdrawalRequest } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminWithdrawalsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Guard: Confirm Admin Privileges from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const adminSupabase = createAdminClient();

  // Fetch all withdrawal requests with member profiles using member_id foreign key
  const { data: requests } = await adminSupabase
    .from('withdrawal_requests')
    .select(`
      *,
      profiles:member_id (
        full_name,
        phone,
        kyc_verified
      )
    `)
    .order('created_at', { ascending: false });

  const allRequests = requests || [];
  const pendingRequests = allRequests.filter((r) => r.status === 'pending');
  const processedRequests = allRequests.filter((r) => r.status !== 'pending');

  const totalPendingKobo = pendingRequests.reduce((acc, curr) => acc + curr.amount, 0);
  const totalCompletedKobo = allRequests
    .filter((r) => r.status === 'approved' || r.status === 'paid')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Admin Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-purple-600 text-white font-bold text-xs uppercase px-2.5 py-1 rounded">
              Admin
            </span>
            <h1 className="font-bold text-lg">Withdrawal Approvals & Payouts</h1>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-slate-300 hover:text-white border border-slate-700 px-3 py-1.5 rounded-lg transition"
          >
            ← Member View
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs uppercase font-semibold text-amber-600 block">
              Pending Approvals
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {pendingRequests.length} requests
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              Total: {formatKoboToNaira(totalPendingKobo)}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs uppercase font-semibold text-emerald-600 block">
              Disbursed Payouts
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {formatKoboToNaira(totalCompletedKobo)}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Successfully initiated</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <span className="text-xs uppercase font-semibold text-slate-500 block">
              Total Request Count
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {allRequests.length}
            </div>
            <span className="text-xs text-slate-500 mt-1 block">All-time withdrawal requests</span>
          </div>
        </div>

        {/* Section 1: Pending Approvals Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Pending Requests Requiring Review</h3>
              <p className="text-xs text-slate-500">
                Approving initiates an instant Paystack transfer using the request ID as reference and creates an append-only ledger debit.
              </p>
            </div>
            <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
              {pendingRequests.length} Pending
            </span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No pending withdrawal requests at this time. 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Member</th>
                    <th className="px-6 py-3.5">Destination Bank</th>
                    <th className="px-6 py-3.5">Amount</th>
                    <th className="px-6 py-3.5">Requested Date</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingRequests.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-50/75 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {req.profiles?.full_name || 'Member'}
                        </div>
                        <div className="text-xs text-slate-500">
                          Phone: {req.profiles?.phone || 'N/A'} • KYC: {req.profiles?.kyc_verified ? 'Verified ✓' : 'No'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 text-xs sm:text-sm">
                          {req.destination_bank_name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {req.destination_account_number} • {req.destination_account_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-700 text-sm">
                        {formatKoboToNaira(req.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(req.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <AdminWithdrawalActions
                          requestId={req.id}
                          accountName={req.destination_account_name}
                          amountFormatted={formatKoboToNaira(req.amount)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Processed History Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="font-bold text-lg text-slate-900">Processed Withdrawal History</h3>
            <p className="text-xs text-slate-500">
              Audit log of approved, paid, and rejected withdrawal requests.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Destination Bank & Account</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Ledger Entry ID</th>
                  <th className="px-6 py-3.5">Admin Notes</th>
                  <th className="px-6 py-3.5">Reviewed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedRequests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-50/75 transition text-xs">
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      {req.profiles?.full_name || 'Member'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">
                      {req.destination_bank_name} ({req.destination_account_number})
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      {formatKoboToNaira(req.amount)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                          req.status === 'approved' || req.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : req.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-500 truncate max-w-[120px]" title={req.ledger_entry_id || ''}>
                      {req.ledger_entry_id || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 max-w-xs truncate">
                      {req.admin_notes || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 whitespace-nowrap">
                      {req.reviewed_at
                        ? new Date(req.reviewed_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}