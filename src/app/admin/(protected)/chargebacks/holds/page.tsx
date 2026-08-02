import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { SETTLEMENT_HOLD_STATUS_COLORS, isHoldOverdue, type SettlementHold } from '@/data/holds';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
}

export default async function SettlementHoldQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('holds.view');
  } catch {
    return <AccessDenied requiredPermission="holds.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('holds.manage');
  } catch {
    canManage = false;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('settlement_holds').select('*').order('placed_at', { ascending: false }).limit(200);
  if (params.status) query = query.eq('status', params.status);
  const { data, error } = await query;
  const holds = (data ?? []) as SettlementHold[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Settlement Hold Queue</h1>
          <p className="text-sm text-[#707975] mt-1">Held amounts are structurally blocked from settlement — enforced when a batch is prepared.</p>
        </div>
        <div className="flex gap-2">
          {canManage && <Link href="/admin/chargebacks/holds/new" className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">Place Hold</Link>}
          <Link href="/admin/chargebacks" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Chargeback Cases</Link>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="released">Released</option>
          </select>
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Filter</button>
      </form>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load holds: {error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Placed</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{merchantNameById.get(h.merchant_id) ?? h.merchant_id}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{h.transaction_id ? 'Transaction' : 'Blanket (all settlements)'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{h.hold_amount !== '0.00' ? formatMoney(h.hold_amount, 'TZS') : '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[240px] truncate">{h.hold_reason}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] whitespace-nowrap">{new Date(h.placed_at).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${SETTLEMENT_HOLD_STATUS_COLORS[isHoldOverdue(h) ? 'expired' : h.status]}`}>
                    {isHoldOverdue(h) ? 'Active (Overdue)' : h.status === 'active' ? 'Active' : 'Released'}
                  </span>
                  {h.release_requested_by && h.status === 'active' && (
                    <span className="block text-[10px] text-[#8a5a00] mt-1">Release requested</span>
                  )}
                </td>
                <td className="px-4 py-3"><Link href={`/admin/chargebacks/holds/${h.id}`} className="text-xs font-medium text-[#00342b] hover:underline">View →</Link></td>
              </tr>
            ))}
            {holds.length === 0 && !error && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">No settlement holds.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
