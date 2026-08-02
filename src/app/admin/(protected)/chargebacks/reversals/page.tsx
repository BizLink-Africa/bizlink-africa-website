import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ReversalRowActions from '@/components/admin/chargebacks/ReversalRowActions';
import { formatMoney } from '@/lib/collections/money';
import { MANUAL_REVERSAL_STATUSES, MANUAL_REVERSAL_STATUS_COLORS, type ManualReversalRequest } from '@/data/reversals';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function ManualReversalsPage() {
  try {
    await requirePermission('reversals.view');
  } catch {
    return <AccessDenied requiredPermission="reversals.view" />;
  }
  let canApprove = true;
  try {
    await requirePermission('reversals.approve');
  } catch {
    canApprove = false;
  }

  const supabase = await createClient();
  const [{ data, error }, { data: merchantRows }] = await Promise.all([
    supabase.from('manual_reversal_requests').select('*').order('requested_at', { ascending: false }).limit(200),
    supabase.from('merchants').select('id, business_name'),
  ]);
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));
  const requests = (data ?? []) as ManualReversalRequest[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Manual Reversal Requests</h1>
          <p className="text-sm text-[#707975] mt-1">Every manual reversal requires a distinct approver — the requester can never approve their own request.</p>
        </div>
        <Link href="/admin/chargebacks" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Chargeback Cases</Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load requests: {error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Requested By</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{merchantNameById.get(r.merchant_id) ?? r.merchant_id}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(r.reversal_amount, 'TZS')}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[240px]">{r.reason}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{r.requested_by}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MANUAL_REVERSAL_STATUS_COLORS[r.status]}`}>
                    {labelFor(MANUAL_REVERSAL_STATUSES, r.status)}
                  </span>
                </td>
                <td className="px-4 py-3">{r.status === 'pending_approval' && <ReversalRowActions requestId={r.id} canApprove={canApprove} />}</td>
              </tr>
            ))}
            {requests.length === 0 && !error && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No manual reversal requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
