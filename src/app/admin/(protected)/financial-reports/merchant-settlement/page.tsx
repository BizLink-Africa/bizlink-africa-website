import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { SETTLEMENT_BATCH_STATUSES, SETTLEMENT_BATCH_STATUS_COLORS } from '@/data/settlement';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams { from?: string; to?: string; status?: string }

export default async function MerchantSettlementReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  let query = supabase.from('settlement_batches').select('*').order('settlement_date', { ascending: false }).limit(500);
  if (params.from) query = query.gte('settlement_date', params.from);
  if (params.to) query = query.lte('settlement_date', params.to);
  if (params.status) query = query.eq('status', params.status);
  const { data, error } = await query;
  const rows = data ?? [];
  const exportUrl = `/admin/financial-reports/merchant-settlement/export?${new URLSearchParams(params as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-6">Merchant Settlement</h1>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label><input type="date" name="from" defaultValue={params.from} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label><input type="date" name="to" defaultValue={params.to} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {SETTLEMENT_BATCH_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Filter</button>
        <a href={exportUrl} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">Export CSV</a>
      </form>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Batch</th><th className="px-4 py-3">Settlement Date</th><th className="px-4 py-3">Merchants</th><th className="px-4 py-3">Net Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{b.batch_number}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] whitespace-nowrap">{b.settlement_date}</td>
                <td className="px-4 py-3 text-[#3f4945]">{b.merchant_count}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(b.merchant_net_total, 'TZS')}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${SETTLEMENT_BATCH_STATUS_COLORS[b.status] ?? ''}`}>{labelFor(SETTLEMENT_BATCH_STATUSES, b.status)}</span></td>
                <td className="px-4 py-3"><Link href={`/admin/settlement/${b.id}`} className="text-xs font-medium text-[#00342b] hover:underline">View →</Link></td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No batches for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
