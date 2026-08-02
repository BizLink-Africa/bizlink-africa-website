import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { MERCHANT_PAYOUT_STATUSES } from '@/data/payouts';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams { from?: string; to?: string; merchant?: string; status?: string }

export default async function FailedPayoutsReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const status = params.status ?? 'failed';
  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');

  let query = supabase.from('merchant_payouts').select('*').eq('status', status).order('requested_at', { ascending: false }).limit(500);
  if (params.from) query = query.gte('requested_at', params.from);
  if (params.to) query = query.lte('requested_at', `${params.to}T23:59:59`);
  if (params.merchant) query = query.eq('merchant_id', params.merchant);
  const { data, error } = await query;
  const rows = data ?? [];
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));
  const exportUrl = `/admin/financial-reports/failed-payouts/export?${new URLSearchParams({ ...params, status } as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-6">Failed Payouts</h1>

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
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={status} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            {MERCHANT_PAYOUT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
              <th className="px-4 py-3">Reference</th><th className="px-4 py-3">Merchant</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Failure Reason</th><th className="px-4 py-3">Retries</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{p.payout_reference}</td>
                <td className="px-4 py-3 text-[#3f4945]">{merchantNameById.get(p.merchant_id) ?? p.merchant_id}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(p.amount, p.currency)}</td>
                <td className="px-4 py-3 text-xs text-red-700 max-w-[240px] truncate">{p.failure_reason ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{p.retry_count}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] whitespace-nowrap">{new Date(p.requested_at).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-3"><Link href={`/admin/payouts/${p.id}`} className="text-xs font-medium text-[#00342b] hover:underline">View →</Link></td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">No {labelFor(MERCHANT_PAYOUT_STATUSES, status).toLowerCase()} payouts for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
