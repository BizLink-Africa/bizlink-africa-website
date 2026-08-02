import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';

export const dynamic = 'force-dynamic';

interface SearchParams { from?: string; to?: string; status?: string }

export default async function DailyReconciliationReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  let query = supabase.from('collection_reconciliation_runs').select('*').order('from_date', { ascending: false }).limit(500);
  if (params.from) query = query.gte('from_date', params.from);
  if (params.to) query = query.lte('to_date', params.to);
  if (params.status) query = query.eq('status', params.status);
  const { data, error } = await query;
  const rows = data ?? [];
  const exportUrl = `/admin/financial-reports/daily-reconciliation/export?${new URLSearchParams(params as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-6">Daily Reconciliation</h1>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label><input type="date" name="from" defaultValue={params.from} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label><input type="date" name="to" defaultValue={params.to} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option><option value="draft">Draft</option><option value="under_review">Under Review</option><option value="approved">Approved</option>
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
              <th className="px-4 py-3">Period</th><th className="px-4 py-3">Net Total</th><th className="px-4 py-3">Vendor Received</th><th className="px-4 py-3">Variance</th><th className="px-4 py-3">Matched/Unresolved</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-xs text-[#3f4945] whitespace-nowrap">{r.from_date} to {r.to_date}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(r.total_net_merchant, 'TZS')}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.vendor_amount_received ? formatMoney(r.vendor_amount_received, 'TZS') : '—'}</td>
                <td className="px-4 py-3 text-xs">{r.variance === '0.00' || r.variance === 0 ? <span className="text-[#1b7a3d]">Zero</span> : <span className="text-[#8a5a00]">{formatMoney(r.variance, 'TZS')}</span>}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{r.matched_count} / {r.unresolved_count}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] capitalize">{r.status.replace('_', ' ')}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No reconciliation runs for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
