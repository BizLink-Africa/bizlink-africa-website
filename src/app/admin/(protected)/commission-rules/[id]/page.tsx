import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import RuleActions from '@/components/admin/commission/RuleActions';
import { formatMoney } from '@/lib/collections/money';
import {
  COMMISSION_TYPES,
  COMMISSION_RULE_STATUSES,
  COMMISSION_RULE_STATUS_COLORS,
  type CommissionFeeRule,
  type CommissionFeeRuleTier,
} from '@/data/commission';
import { SERVICE_CATALOG } from '@/data/services';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function CommissionRuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  let canApprove = true;
  try {
    await requirePermission('commission_rules.approve');
  } catch {
    canApprove = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: rule } = await supabase.from('commission_fee_rules').select('*').eq('id', id).maybeSingle();
  if (!rule) notFound();
  const typedRule = rule as CommissionFeeRule;

  const [{ data: merchant }, { data: tierRows }] = await Promise.all([
    typedRule.merchant_id
      ? supabase.from('merchants').select('business_name').eq('id', typedRule.merchant_id).maybeSingle()
      : Promise.resolve({ data: null }),
    typedRule.commission_type === 'tiered'
      ? supabase.from('commission_fee_rule_tiers').select('*').eq('rule_id', id).order('tier_order', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const tiers = (tierRows ?? []) as CommissionFeeRuleTier[];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{labelFor(COMMISSION_TYPES, typedRule.commission_type)} Rule — v{typedRule.version_number}</h1>
          <p className="text-sm text-[#707975] mt-1">
            {typedRule.merchant_id ? merchant?.business_name ?? 'Merchant' : 'All merchants'}
            {' / '}
            {typedRule.service_key ? labelFor(SERVICE_CATALOG, typedRule.service_key) : 'All services'}
          </p>
        </div>
        <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${COMMISSION_RULE_STATUS_COLORS[typedRule.status] ?? ''}`}>
          {labelFor(COMMISSION_RULE_STATUSES, typedRule.status)}
        </span>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4 mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {typedRule.commission_type === 'percentage' && <Field label="Percentage Rate" value={`${typedRule.percentage_rate}%`} />}
          {typedRule.commission_type === 'fixed' && <Field label="Fixed Fee" value={formatMoney(typedRule.fixed_fee_amount, typedRule.currency)} />}
          <Field label="Minimum Fee" value={typedRule.minimum_fee ? formatMoney(typedRule.minimum_fee, typedRule.currency) : '—'} />
          <Field label="Maximum Fee" value={typedRule.maximum_fee ? formatMoney(typedRule.maximum_fee, typedRule.currency) : '—'} />
          <Field label="Settlement Fee" value={formatMoney(typedRule.settlement_fee, typedRule.currency)} />
          <Field label="Monthly Technology Fee" value={formatMoney(typedRule.monthly_technology_fee, typedRule.currency)} />
          <Field label="Effective Date" value={typedRule.effective_date} />
          <Field label="Expiry Date" value={typedRule.expiry_date ?? '—'} />
          <Field label="Allow Overlap" value={typedRule.allow_overlap ? 'Yes' : 'No'} />
          <Field label="Contract Reference" value={typedRule.contract_id ?? '—'} />
        </dl>

        {typedRule.commission_type === 'tiered' && tiers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-2">Tiers</p>
            <table className="w-full text-sm border border-[#efeded]">
              <thead>
                <tr className="bg-[#f5f3f3] text-left text-xs text-[#707975] uppercase tracking-wider">
                  <th className="px-3 py-2">Min</th>
                  <th className="px-3 py-2">Max</th>
                  <th className="px-3 py-2">Rate</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.id} className="border-t border-[#efeded]">
                    <td className="px-3 py-2">{formatMoney(t.min_amount, typedRule.currency)}</td>
                    <td className="px-3 py-2">{t.max_amount ? formatMoney(t.max_amount, typedRule.currency) : 'Unbounded'}</td>
                    <td className="px-3 py-2">{t.tier_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#efeded] pt-4">
          <Field label="Reason for This Rate" value={typedRule.change_reason} block />
        </div>

        <div className="border-t border-[#efeded] pt-4 grid grid-cols-2 gap-4 text-xs text-[#707975]">
          <Field label="Created By" value={typedRule.created_by} small />
          <Field label="Created At" value={new Date(typedRule.created_at).toLocaleString('en-GB')} small />
          {typedRule.approved_by && <Field label="Approved By" value={typedRule.approved_by} small />}
          {typedRule.approved_at && <Field label="Approved At" value={new Date(typedRule.approved_at).toLocaleString('en-GB')} small />}
          {typedRule.review_notes && <Field label="Review Notes" value={typedRule.review_notes} small block />}
          {typedRule.expired_by && <Field label="Expired By" value={typedRule.expired_by} small />}
          {typedRule.expiry_reason && <Field label="Expiry Reason" value={typedRule.expiry_reason} small block />}
        </div>
      </div>

      <RuleActions ruleId={typedRule.id} status={typedRule.status} effectiveDate={typedRule.effective_date} canManage={canManage} canApprove={canApprove} />
    </div>
  );
}

function Field({ label, value, block, small }: { label: string; value: string; block?: boolean; small?: boolean }) {
  return (
    <div className={block ? 'col-span-2' : ''}>
      <dt className={`font-semibold text-[#707975] uppercase tracking-wider ${small ? 'text-[10px]' : 'text-xs'} mb-0.5`}>{label}</dt>
      <dd className={small ? 'text-xs text-[#3f4945]' : 'text-[#1b1c1c]'}>{value}</dd>
    </div>
  );
}
