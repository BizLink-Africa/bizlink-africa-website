export const COMMISSION_TYPES = [
  { value: 'percentage', label: 'Percentage Commission' },
  { value: 'fixed', label: 'Fixed Fee' },
  { value: 'tiered', label: 'Tiered Commission' },
] as const;

export type CommissionType = (typeof COMMISSION_TYPES)[number]['value'];

export const COMMISSION_RULE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
] as const;

export type CommissionRuleStatus = (typeof COMMISSION_RULE_STATUSES)[number]['value'];

export const COMMISSION_RULE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-[#efeded] text-[#707975]',
};

// Derived, display-only states layered on top of an 'approved' row — never
// persisted. A rule is either scheduled (effective in the future), active
// (in its effective window), or ended (past its expiry_date but the
// explicit expire_commission_fee_rule() action was never called).
export type CommissionRuleEffectiveState = 'scheduled' | 'active' | 'ended';

export const COMMISSION_RULE_EFFECTIVE_STATE_COLORS: Record<CommissionRuleEffectiveState, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  ended: 'bg-[#efeded] text-[#707975]',
};

export function commissionRuleEffectiveState(
  rule: Pick<CommissionFeeRule, 'effective_date' | 'expiry_date'>,
  today: string = new Date().toISOString().slice(0, 10)
): CommissionRuleEffectiveState {
  if (rule.effective_date > today) return 'scheduled';
  if (rule.expiry_date && rule.expiry_date < today) return 'ended';
  return 'active';
}

export interface CommissionFeeRule {
  id: string;
  rule_group_id: string;
  version_number: number;
  previous_version_id: string | null;

  commission_type: CommissionType;
  // All rate/fee columns are decimal strings — never numbers. See
  // src/lib/commission/calculate.ts for why (exact BigInt arithmetic,
  // never JS floating point).
  percentage_rate: string | null;
  fixed_fee_amount: string | null;
  minimum_fee: string | null;
  maximum_fee: string | null;
  settlement_fee: string;
  monthly_technology_fee: string;
  currency: string;

  effective_date: string;
  expiry_date: string | null;

  merchant_id: string | null;
  service_key: string | null;
  contract_id: string | null;
  allow_overlap: boolean;

  status: CommissionRuleStatus;
  change_reason: string;

  created_by: string;
  created_at: string;

  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;

  approved_by: string | null;
  approved_at: string | null;

  expired_by: string | null;
  expired_at: string | null;
  expiry_reason: string | null;
}

export interface CommissionFeeRuleTier {
  id: string;
  rule_id: string;
  tier_order: number;
  min_amount: string;
  max_amount: string | null;
  tier_percentage: string;
}
