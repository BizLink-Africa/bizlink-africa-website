import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

interface SearchParams { from?: string; to?: string; module?: string }

export default async function FinancialAuditTrailReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('audit_logs').select('*').in('record_type', ['finance', 'compliance']).order('created_at', { ascending: false }).limit(500);
  if (params.from) query = query.gte('created_at', params.from);
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59`);
  if (params.module) query = query.eq('module', params.module);
  const { data, error } = await query;
  const rows = data ?? [];
  const exportUrl = `/admin/financial-reports/audit-trail/export?${new URLSearchParams(params as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-1">Financial Audit Trail</h1>
      <p className="text-sm text-[#707975] mb-6">Every finance and compliance action, including every export from this report suite.</p>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label><input type="date" name="from" defaultValue={params.from} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div><label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label><input type="date" name="to" defaultValue={params.to} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" /></div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Module</label>
          <input type="text" name="module" defaultValue={params.module} placeholder="e.g. merchant_payouts" className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Filter</button>
        <a href={exportUrl} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">Export CSV</a>
      </form>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">When</th><th className="px-4 py-3">Performed By</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-xs text-[#3f4945] whitespace-nowrap">{new Date(a.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{a.performed_by}</td>
                <td className="px-4 py-3 text-xs text-[#1b1c1c] font-medium">{a.action_type}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{a.module}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[160px] truncate">{a.record_id ?? '—'}</td>
                <td className="px-4 py-3 text-xs">{a.result === 'success' ? <span className="text-[#1b7a3d]">Success</span> : <span className="text-red-700">Failure</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No audit events for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
