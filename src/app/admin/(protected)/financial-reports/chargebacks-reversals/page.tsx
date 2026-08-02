import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { CHARGEBACK_CASE_STATUSES, CHARGEBACK_CASE_STATUS_COLORS } from '@/data/chargebacks';
import { MANUAL_REVERSAL_STATUSES, MANUAL_REVERSAL_STATUS_COLORS } from '@/data/reversals';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams { from?: string; to?: string; merchant?: string }

export default async function ChargebacksReversalsReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let caseQuery = supabase.from('chargeback_cases').select('*').order('opened_at', { ascending: false }).limit(300);
  if (params.from) caseQuery = caseQuery.gte('opened_at', params.from);
  if (params.to) caseQuery = caseQuery.lte('opened_at', `${params.to}T23:59:59`);
  if (params.merchant) caseQuery = caseQuery.eq('merchant_id', params.merchant);

  let reversalQuery = supabase.from('manual_reversal_requests').select('*').order('requested_at', { ascending: false }).limit(300);
  if (params.from) reversalQuery = reversalQuery.gte('requested_at', params.from);
  if (params.to) reversalQuery = reversalQuery.lte('requested_at', `${params.to}T23:59:59`);
  if (params.merchant) reversalQuery = reversalQuery.eq('merchant_id', params.merchant);

  const [{ data: cases, error: caseError }, { data: reversals, error: reversalError }] = await Promise.all([caseQuery, reversalQuery]);
  const exportUrl = `/admin/financial-reports/chargebacks-reversals/export?${new URLSearchParams(params as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-6">Chargebacks &amp; Reversals</h1>

      <form className="mb-6 flex flex-wrap gap-3 items-end">
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

      <h2 className="font-semibold text-[#00342b] mb-3">Chargeback Cases</h2>
      {caseError && <p className="mb-4 text-sm text-red-700">{caseError.message}</p>}
      <div className="bg-white border border-[#bfc9c4] overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[800px]">
          <thead><tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider"><th className="px-4 py-3">Case</th><th className="px-4 py-3">Merchant</th><th className="px-4 py-3">Disputed</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>
            {(cases ?? []).map((c) => (
              <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{c.case_reference}</td>
                <td className="px-4 py-3 text-[#3f4945]">{merchantNameById.get(c.merchant_id) ?? c.merchant_id}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(c.disputed_amount, 'TZS')}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${CHARGEBACK_CASE_STATUS_COLORS[c.case_status] ?? ''}`}>{labelFor(CHARGEBACK_CASE_STATUSES, c.case_status)}</span></td>
              </tr>
            ))}
            {(cases ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[#707975]">No cases for this filter.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold text-[#00342b] mb-3">Manual Reversals</h2>
      {reversalError && <p className="mb-4 text-sm text-red-700">{reversalError.message}</p>}
      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead><tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider"><th className="px-4 py-3">Merchant</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>
            {(reversals ?? []).map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{merchantNameById.get(r.merchant_id) ?? r.merchant_id}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(r.reversal_amount, 'TZS')}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[280px] truncate">{r.reason}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MANUAL_REVERSAL_STATUS_COLORS[r.status] ?? ''}`}>{labelFor(MANUAL_REVERSAL_STATUSES, r.status)}</span></td>
              </tr>
            ))}
            {(reversals ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[#707975]">No reversals for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
