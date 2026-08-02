import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import AddMerchantForm from '@/components/admin/merchant/AddMerchantForm';
import {
  MERCHANT_ONBOARDING_STATUSES,
  MERCHANT_ONBOARDING_STATUS_COLORS,
  MERCHANT_RISK_STATUSES,
  MERCHANT_RISK_COLORS,
  type Merchant,
} from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  risk?: string;
}

// The directory view over the same merchants table Applications shows as a
// status-workflow queue — every merchant regardless of stage, searchable.
export default async function MerchantProfilesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('merchants.view');
  } catch {
    return <AccessDenied requiredPermission="merchants.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();

  const { data: staffRows } = await supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name');
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  let query = supabase
    .from('merchants')
    .select('id, business_name, trading_name, business_category, risk_status, onboarding_status, settlement_status, assigned_staff_id, compliance_hold, updated_at')
    .order('updated_at', { ascending: false });

  if (params.q) {
    const term = params.q.trim();
    query = query.or(`business_name.ilike.%${term}%,trading_name.ilike.%${term}%`);
  }
  if (params.risk) {
    query = query.eq('risk_status', params.risk);
  }

  const { data, error } = await query;
  const merchants = (data ?? []) as Pick<
    Merchant,
    'id' | 'business_name' | 'trading_name' | 'business_category' | 'risk_status' | 'onboarding_status' | 'settlement_status' | 'assigned_staff_id' | 'compliance_hold' | 'updated_at'
  >[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Merchant Profiles</h1>
          <p className="text-sm text-[#707975] mt-1">{merchants.length} result{merchants.length === 1 ? '' : 's'}</p>
        </div>
        <AddMerchantForm />
      </div>

      <form className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Search business or trading name…"
          className="border border-[#bfc9c4] px-3 py-2 text-sm min-w-[240px] focus:border-[#00342b] focus:outline-none"
        />
        <select name="risk" defaultValue={params.risk ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
          <option value="">All Risk Levels</option>
          {MERCHANT_RISK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
          Filter
        </button>
      </form>

      {error && (
        <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load merchant profiles: {error.message}
        </p>
      )}

      <div className="mt-4 bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Onboarding</th>
              <th className="px-4 py-3">Settlement</th>
              <th className="px-4 py-3">Assigned Staff</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3">
                  <Link href={`/admin/merchant-operations/profiles/${m.id}`} className="font-medium text-[#00342b] hover:underline">
                    {m.business_name}
                  </Link>
                  {m.trading_name && <div className="text-xs text-[#707975]">{m.trading_name}</div>}
                  {m.compliance_hold && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#fbe4e4] text-[#8a1f1f]">
                      Compliance Hold
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{m.business_category ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_RISK_COLORS[m.risk_status] ?? ''}`}>
                    {labelFor(MERCHANT_RISK_STATUSES, m.risk_status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_ONBOARDING_STATUS_COLORS[m.onboarding_status] ?? ''}`}>
                    {labelFor(MERCHANT_ONBOARDING_STATUSES, m.onboarding_status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#3f4945] capitalize">{m.settlement_status.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-[#3f4945]">{m.assigned_staff_id ? staffNameById.get(m.assigned_staff_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/merchant-operations/profiles/${m.id}`}
                    className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {merchants.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No merchant profiles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
