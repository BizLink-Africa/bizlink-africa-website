import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { COMMISSION_TYPES, type CommissionFeeRule } from '@/data/commission';
import { SERVICE_CATALOG } from '@/data/services';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function PendingCommissionRulesPage() {
  try {
    await requirePermission('commission_rules.approve');
  } catch {
    return <AccessDenied requiredPermission="commission_rules.approve" />;
  }

  const supabase = await createClient();
  const [{ data: rows, error }, { data: merchantRows }] = await Promise.all([
    supabase.from('commission_fee_rules').select('*').eq('status', 'pending_approval').order('created_at', { ascending: true }),
    supabase.from('merchants').select('id, business_name'),
  ]);
  const rules = (rows ?? []) as CommissionFeeRule[];
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Pending Approval</h1>
        <p className="text-sm text-[#707975] mt-1">
          Rules submitted for review. The approver must be a different Finance user from whoever submitted it.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load rules: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
        {rules.map((r) => (
          <div key={r.id} className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-[#1b1c1c]">
                {labelFor(COMMISSION_TYPES, r.commission_type)}
                {r.commission_type === 'percentage' && ` — ${r.percentage_rate}%`}
                {r.commission_type === 'fixed' && ` — ${formatMoney(r.fixed_fee_amount, r.currency)}`}
              </p>
              <p className="text-xs text-[#707975] mt-0.5">
                {r.merchant_id ? merchantNameById.get(r.merchant_id) ?? 'Merchant' : 'All merchants'}
                {' / '}
                {r.service_key ? labelFor(SERVICE_CATALOG, r.service_key) : 'All services'}
                {' · '}Effective {r.effective_date} · Submitted by {r.created_by}
              </p>
              <p className="text-xs text-[#707975] mt-0.5 italic">&quot;{r.change_reason}&quot;</p>
            </div>
            <Link href={`/admin/commission-rules/${r.id}`} className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
              Review →
            </Link>
          </div>
        ))}
        {rules.length === 0 && !error && (
          <p className="px-5 py-10 text-center text-sm text-[#707975]">No rules pending approval.</p>
        )}
      </div>
    </div>
  );
}
