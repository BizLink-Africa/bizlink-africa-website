import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import AddMerchantForm from '@/components/admin/merchant/AddMerchantForm';
import { MERCHANT_ONBOARDING_STATUSES, MERCHANT_ONBOARDING_STATUS_COLORS, type Merchant } from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
}

// "Applications" is a workflow-focused view over the same merchants table
// "Profiles" lists as a directory — pre-Active statuses by default, so
// staff coordinating onboarding see exactly the queue that needs action.
const PRE_ACTIVE_STATUSES = MERCHANT_ONBOARDING_STATUSES.map((s) => s.value).filter(
  (v) => v !== 'active' && v !== 'rejected' && v !== 'suspended'
);

export default async function MerchantApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('merchants.view');
  } catch {
    return <AccessDenied requiredPermission="merchants.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('merchants')
    .select('id, business_name, trading_name, contact_person_name, contact_phone, onboarding_status, compliance_hold, created_at')
    .order('created_at', { ascending: false });

  if (params.status) {
    query = query.eq('onboarding_status', params.status);
  } else {
    query = query.in('onboarding_status', PRE_ACTIVE_STATUSES);
  }

  const { data, error } = await query;
  const merchants = (data ?? []) as Pick<
    Merchant,
    'id' | 'business_name' | 'trading_name' | 'contact_person_name' | 'contact_phone' | 'onboarding_status' | 'compliance_hold' | 'created_at'
  >[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Merchant Applications</h1>
          <p className="text-sm text-[#707975] mt-1">
            {merchants.length} result{merchants.length === 1 ? '' : 's'}
            {!params.status && ' — showing applications not yet Active, Rejected, or Suspended'}
          </p>
        </div>
        <AddMerchantForm />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link
          href="/admin/merchant-operations/applications"
          className={`px-3 py-1.5 border ${!params.status ? 'bg-[#00342b] text-white border-[#00342b]' : 'border-[#bfc9c4] text-[#3f4945] hover:border-[#00342b]'}`}
        >
          In Progress
        </Link>
        {MERCHANT_ONBOARDING_STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/merchant-operations/applications?status=${s.value}`}
            className={`px-3 py-1.5 border ${params.status === s.value ? 'bg-[#00342b] text-white border-[#00342b]' : 'border-[#bfc9c4] text-[#3f4945] hover:border-[#00342b]'}`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load merchant applications: {error.message}
        </p>
      )}

      <div className="mt-4 bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
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
                <td className="px-4 py-3 text-[#3f4945]">
                  <div>{m.contact_person_name ?? '—'}</div>
                  <div className="text-xs text-[#707975]">{m.contact_phone ?? ''}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_ONBOARDING_STATUS_COLORS[m.onboarding_status] ?? ''}`}>
                    {labelFor(MERCHANT_ONBOARDING_STATUSES, m.onboarding_status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
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
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No merchant applications in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
