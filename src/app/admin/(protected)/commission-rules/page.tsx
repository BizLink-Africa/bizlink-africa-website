import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import {
  COMMISSION_TYPES,
  COMMISSION_RULE_STATUSES,
  COMMISSION_RULE_STATUS_COLORS,
  type CommissionFeeRule,
} from '@/data/commission';
import { SERVICE_CATALOG } from '@/data/services';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  merchant?: string;
}

export default async function CommissionRulesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('commission_rules.view');
  } catch {
    return <AccessDenied requiredPermission="commission_rules.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('commission_rules.manage');
  } catch {
    canManage = false;
  }

  const params = await searchParams;
  const supabase = await createClient();

  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('commission_fee_rules').select('*').order('created_at', { ascending: false }).limit(200);
  if (params.status) query = query.eq('status', params.status);
  if (params.merchant) query = query.eq('merchant_id', params.merchant);

  const { data, error } = await query;
  const rules = (data ?? []) as CommissionFeeRule[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Commission &amp; Fee Rules</h1>
          <p className="text-sm text-[#707975] mt-1">
            Super Admin / authorised Finance only. Every rate change is a new version — approved rules are immutable.
          </p>
        </div>
        {canManage && (
          <Link href="/admin/commission-rules/new" className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">
            New Rule
          </Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {COMMISSION_RULE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Merchant</label>
          <select name="merchant" defaultValue={params.merchant ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {(merchantRows ?? []).map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
          </select>
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
          Filter
        </button>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load rules: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Effective</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c]">{labelFor(COMMISSION_TYPES, r.commission_type)}</td>
                <td className="px-4 py-3 text-[#3f4945]">
                  {r.commission_type === 'percentage' && `${r.percentage_rate}%`}
                  {r.commission_type === 'fixed' && formatMoney(r.fixed_fee_amount, r.currency)}
                  {r.commission_type === 'tiered' && 'Tiered'}
                </td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">
                  {r.merchant_id ? merchantNameById.get(r.merchant_id) ?? 'Merchant' : 'All merchants'}
                  {' / '}
                  {r.service_key ? labelFor(SERVICE_CATALOG, r.service_key) : 'All services'}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">v{r.version_number}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs whitespace-nowrap">{r.effective_date}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs whitespace-nowrap">{r.expiry_date ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${COMMISSION_RULE_STATUS_COLORS[r.status] ?? ''}`}>
                    {labelFor(COMMISSION_RULE_STATUSES, r.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/commission-rules/${r.id}`} className="text-xs font-medium text-[#00342b] hover:underline">View →</Link>
                </td>
              </tr>
            ))}
            {rules.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">No commission rules yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
