import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

interface SearchParams { from?: string; to?: string; merchant?: string; status?: string }

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};

export default async function BeneficiaryChangesReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('merchant_beneficiary_change_requests').select('*').order('requested_at', { ascending: false }).limit(500);
  if (params.from) query = query.gte('requested_at', params.from);
  if (params.to) query = query.lte('requested_at', `${params.to}T23:59:59`);
  if (params.merchant) query = query.eq('merchant_id', params.merchant);
  if (params.status) query = query.eq('status', params.status);
  const { data, error } = await query;
  const rows = data ?? [];
  const exportUrl = `/admin/financial-reports/beneficiary-changes/export?${new URLSearchParams(params as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-1">Beneficiary Changes</h1>
      <p className="text-sm text-[#707975] mb-6">Destination values are never shown here — masked form only.</p>

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
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option><option value="pending_approval">Pending Approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
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
              <th className="px-4 py-3">Merchant</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">New Value (Masked)</th><th className="px-4 py-3">Requested By</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{merchantNameById.get(r.merchant_id) ?? r.merchant_id}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] capitalize">{r.request_type?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{r.proposed_masked_value ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{r.requested_by}</td>
                <td className="px-4 py-3"><span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? ''}`}>{r.status.replace('_', ' ')}</span></td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">No beneficiary changes for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
