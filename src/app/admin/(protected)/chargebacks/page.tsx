import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { CHARGEBACK_CASE_STATUSES, CHARGEBACK_CASE_STATUS_COLORS, CHARGEBACK_REASONS, type ChargebackCase } from '@/data/chargebacks';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  merchant?: string;
}

export default async function ChargebackCaseListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('chargebacks.view');
  } catch {
    return <AccessDenied requiredPermission="chargebacks.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('chargebacks.manage');
  } catch {
    canManage = false;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('chargeback_cases').select('*').order('opened_at', { ascending: false }).limit(200);
  if (params.status) query = query.eq('case_status', params.status);
  if (params.merchant) query = query.eq('merchant_id', params.merchant);
  const { data, error } = await query;
  const cases = (data ?? []) as ChargebackCase[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Chargeback Cases</h1>
          <p className="text-sm text-[#707975] mt-1">Full history preserved — resolved cases are never deleted.</p>
        </div>
        <div className="flex gap-2">
          {canManage && <Link href="/admin/chargebacks/new" className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">Open Case</Link>}
          <Link href="/admin/chargebacks/holds" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Hold Queue</Link>
          <Link href="/admin/chargebacks/reversals" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Reversals</Link>
          <Link href="/admin/chargebacks/exposure" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Merchant Exposure</Link>
          <Link href="/admin/chargebacks/reporting" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Reporting</Link>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {CHARGEBACK_CASE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Merchant</label>
          <select name="merchant" defaultValue={params.merchant ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {(merchantRows ?? []).map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
          </select>
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Filter</button>
      </form>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load cases: {error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Disputed</th>
              <th className="px-4 py-3">Evidence Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{c.case_reference}</td>
                <td className="px-4 py-3 text-[#3f4945]">{merchantNameById.get(c.merchant_id) ?? c.merchant_id}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{labelFor(CHARGEBACK_REASONS, c.reason)}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(c.disputed_amount, 'TZS')}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] whitespace-nowrap">{c.evidence_due_at ? new Date(c.evidence_due_at).toLocaleDateString('en-GB') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${CHARGEBACK_CASE_STATUS_COLORS[c.case_status] ?? ''}`}>
                    {labelFor(CHARGEBACK_CASE_STATUSES, c.case_status)}
                  </span>
                </td>
                <td className="px-4 py-3"><Link href={`/admin/chargebacks/${c.id}`} className="text-xs font-medium text-[#00342b] hover:underline">View →</Link></td>
              </tr>
            ))}
            {cases.length === 0 && !error && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">No chargeback cases.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
