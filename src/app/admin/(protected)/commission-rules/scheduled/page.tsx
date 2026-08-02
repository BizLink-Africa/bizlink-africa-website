import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { COMMISSION_TYPES, type CommissionFeeRule } from '@/data/commission';
import { SERVICE_CATALOG } from '@/data/services';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

// "Scheduled" is not a persisted status — it is an approved rule whose
// effective_date has not arrived yet. This view exists purely to give
// Finance visibility into what is coming up next.
export default async function ScheduledCommissionRulesPage() {
  try {
    await requirePermission('commission_rules.view');
  } catch {
    return <AccessDenied requiredPermission="commission_rules.view" />;
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: rows, error }, { data: merchantRows }] = await Promise.all([
    supabase
      .from('commission_fee_rules')
      .select('*')
      .eq('status', 'approved')
      .gt('effective_date', today)
      .order('effective_date', { ascending: true }),
    supabase.from('merchants').select('id, business_name'),
  ]);
  const rules = (rows ?? []) as CommissionFeeRule[];
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Scheduled Rules</h1>
        <p className="text-sm text-[#707975] mt-1">Approved rules whose effective date is still in the future.</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load rules: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
        {rules.map((r) => (
          <div key={r.id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-[#1b1c1c]">
                {labelFor(COMMISSION_TYPES, r.commission_type)} — v{r.version_number}
              </p>
              <p className="text-xs text-[#707975] mt-0.5">
                {r.merchant_id ? merchantNameById.get(r.merchant_id) ?? 'Merchant' : 'All merchants'}
                {' / '}
                {r.service_key ? labelFor(SERVICE_CATALOG, r.service_key) : 'All services'}
                {' · '}Takes effect {r.effective_date}
              </p>
            </div>
            <Link href={`/admin/commission-rules/${r.id}`} className="text-xs font-medium text-[#00342b] hover:underline">View →</Link>
          </div>
        ))}
        {rules.length === 0 && !error && (
          <p className="px-5 py-10 text-center text-sm text-[#707975]">No rules scheduled for a future effective date.</p>
        )}
      </div>
    </div>
  );
}
