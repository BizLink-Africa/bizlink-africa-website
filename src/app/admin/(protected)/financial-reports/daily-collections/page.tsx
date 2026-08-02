import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';

export const dynamic = 'force-dynamic';

interface Row { collection_date: string; merchant_id: string; business_name: string; transaction_count: number; gross_amount: string; provider_fee_total: string; bizlink_commission_total: string; net_amount: string }

interface SearchParams { from?: string; to?: string; merchant?: string }

export default async function DailyCollectionsReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');

  let query = supabase.from('v_daily_collections_by_merchant').select('*').order('collection_date', { ascending: false }).limit(500);
  if (params.from) query = query.gte('collection_date', params.from);
  if (params.to) query = query.lte('collection_date', params.to);
  if (params.merchant) query = query.eq('merchant_id', params.merchant);
  const { data, error } = await query;
  const rows = (data ?? []) as Row[];

  const exportUrl = `/admin/financial-reports/daily-collections/export?${new URLSearchParams(params as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-6">Daily Collections</h1>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label><input type="date" name="from" defaultValue={params.from} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label><input type="date" name="to" defaultValue={params.to} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Merchant</label>
          <select name="merchant" defaultValue={params.merchant ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {(merchantRows ?? []).map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
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
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Merchant</th><th className="px-4 py-3">Txns</th>
              <th className="px-4 py-3">Gross</th><th className="px-4 py-3">Fees</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#3f4945] text-xs whitespace-nowrap">{r.collection_date}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{r.business_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.transaction_count}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(r.gross_amount, 'TZS')}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(r.provider_fee_total, 'TZS')}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(r.bizlink_commission_total, 'TZS')}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(r.net_amount, 'TZS')}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">No data for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
