'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { isValidMoneyString } from '@/lib/collections/money';
import { calculateCommission, type CommissionRuleInput, type CommissionTier } from '@/lib/commission/calculate';
import { resolveApplicableCommissionRule } from '@/lib/commission/resolve';
import type { CommissionFeeRule, CommissionType } from '@/data/commission';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Percentage rates use 4 decimal places (e.g. "2.5000"), unlike money
// fields which use 2 — isValidMoneyString would wrongly reject a valid rate.
function isValidPercentageString(value: string): boolean {
  return /^\d{1,3}(\.\d{1,4})?$/.test(value.trim()) && Number(value) <= 100;
}

interface ActionResult {
  success: boolean;
  message?: string;
  ruleId?: string;
}

export interface NewRuleTierInput {
  tierOrder: number;
  minAmount: string;
  maxAmount: string | null;
  tierPercentage: string;
}

export interface NewRuleInput {
  commissionType: CommissionType;
  percentageRate: string | null;
  fixedFeeAmount: string | null;
  minimumFee: string | null;
  maximumFee: string | null;
  settlementFee: string;
  monthlyTechnologyFee: string;
  currency: string;
  effectiveDate: string;
  expiryDate: string | null;
  merchantId: string | null;
  serviceKey: string | null;
  contractId: string | null;
  allowOverlap: boolean;
  changeReason: string;
  tiers: NewRuleTierInput[];
}

// The only write path for a new commission_fee_rules row — always inserted
// as a 'draft'. RLS independently enforces status = 'draft' on insert (see
// the migration), so even a bypassed client could never insert an
// already-approved row here.
export async function createCommissionFeeRule(input: NewRuleInput): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('commission_rules.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create commission and fee rules.' };
  }

  if (!isNonEmptyString(input.changeReason)) {
    return { success: false, message: 'A reason for this rate change is required.' };
  }
  if (!isNonEmptyString(input.effectiveDate)) {
    return { success: false, message: 'An effective date is required.' };
  }
  if (input.expiryDate && input.expiryDate < input.effectiveDate) {
    return { success: false, message: 'Expiry date cannot be before the effective date.' };
  }

  if (input.commissionType === 'percentage') {
    if (!isNonEmptyString(input.percentageRate) || !isValidPercentageString(input.percentageRate)) {
      return { success: false, message: 'A valid percentage rate (0–100) is required for a percentage rule.' };
    }
  }
  if (input.commissionType === 'fixed') {
    if (!isNonEmptyString(input.fixedFeeAmount) || !isValidMoneyString(input.fixedFeeAmount)) {
      return { success: false, message: 'A valid fixed fee amount is required for a fixed rule.' };
    }
  }
  if (input.commissionType === 'tiered') {
    if (input.tiers.length === 0) {
      return { success: false, message: 'At least one tier is required for a tiered rule.' };
    }
    for (const tier of input.tiers) {
      if (!isValidMoneyString(tier.minAmount) || (tier.maxAmount !== null && !isValidMoneyString(tier.maxAmount))) {
        return { success: false, message: `Invalid amount in tier ${tier.tierOrder + 1}.` };
      }
      if (!isValidPercentageString(tier.tierPercentage)) {
        return { success: false, message: `Invalid percentage in tier ${tier.tierOrder + 1}.` };
      }
    }
  }
  if (input.minimumFee && !isValidMoneyString(input.minimumFee)) {
    return { success: false, message: 'Invalid minimum fee.' };
  }
  if (input.maximumFee && !isValidMoneyString(input.maximumFee)) {
    return { success: false, message: 'Invalid maximum fee.' };
  }
  if (!isValidMoneyString(input.settlementFee || '0')) {
    return { success: false, message: 'Invalid settlement fee.' };
  }
  if (!isValidMoneyString(input.monthlyTechnologyFee || '0')) {
    return { success: false, message: 'Invalid monthly technology fee.' };
  }

  const supabase = await createClient();

  const { data: rule, error } = await supabase
    .from('commission_fee_rules')
    .insert({
      commission_type: input.commissionType,
      percentage_rate: input.commissionType === 'percentage' ? input.percentageRate : null,
      fixed_fee_amount: input.commissionType === 'fixed' ? input.fixedFeeAmount : null,
      minimum_fee: input.minimumFee || null,
      maximum_fee: input.maximumFee || null,
      settlement_fee: input.settlementFee || '0',
      monthly_technology_fee: input.monthlyTechnologyFee || '0',
      currency: input.currency || 'TZS',
      effective_date: input.effectiveDate,
      expiry_date: input.expiryDate || null,
      merchant_id: input.merchantId || null,
      service_key: input.serviceKey || null,
      contract_id: input.contractId || null,
      allow_overlap: input.allowOverlap,
      status: 'draft',
      change_reason: input.changeReason.trim().slice(0, 1000),
      created_by: user.email ?? 'unknown',
    })
    .select('id')
    .single();

  if (error || !rule) {
    console.error('Failed to create commission fee rule', error);
    return { success: false, message: 'Failed to create the rule.' };
  }

  if (input.commissionType === 'tiered') {
    const { error: tierError } = await supabase.from('commission_fee_rule_tiers').insert(
      input.tiers.map((t) => ({
        rule_id: rule.id,
        tier_order: t.tierOrder,
        min_amount: t.minAmount,
        max_amount: t.maxAmount || null,
        tier_percentage: t.tierPercentage,
      }))
    );
    if (tierError) {
      console.error('Failed to create commission fee rule tiers', tierError);
      return { success: true, ruleId: rule.id, message: 'Rule created, but tiers failed to save — edit the draft to add tiers before submitting.' };
    }
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create_draft',
    module: 'commission_fee_rules',
    recordId: rule.id,
    newValue: {
      commissionType: input.commissionType,
      merchantId: input.merchantId,
      serviceKey: input.serviceKey,
      effectiveDate: input.effectiveDate,
      changeReason: input.changeReason,
    },
  });

  revalidatePath('/admin/commission-rules');
  return { success: true, ruleId: rule.id };
}

export async function submitCommissionFeeRule(ruleId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('commission_rules.manage');
  } catch {
    return { success: false, message: 'You do not have permission to submit commission and fee rules.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_commission_fee_rule_for_approval', { p_rule_id: ruleId });
  if (error) {
    console.error('Failed to submit commission fee rule', ruleId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'submit_for_approval',
    module: 'commission_fee_rules',
    recordId: ruleId,
  });

  revalidatePath('/admin/commission-rules');
  revalidatePath(`/admin/commission-rules/${ruleId}`);
  revalidatePath('/admin/commission-rules/pending');
  return { success: true, ruleId };
}

export async function approveCommissionFeeRule(ruleId: string, approvalNotes: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('commission_rules.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve commission and fee rules.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_commission_fee_rule', {
    p_rule_id: ruleId,
    p_approval_notes: approvalNotes?.trim() || null,
  });
  if (error) {
    console.error('Failed to approve commission fee rule', ruleId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'approve',
    module: 'commission_fee_rules',
    recordId: ruleId,
    newValue: { approvalNotes },
  });

  revalidatePath('/admin/commission-rules');
  revalidatePath(`/admin/commission-rules/${ruleId}`);
  revalidatePath('/admin/commission-rules/pending');
  revalidatePath('/admin/commission-rules/scheduled');
  return { success: true, ruleId };
}

export async function rejectCommissionFeeRule(ruleId: string, reviewNotes: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('commission_rules.approve');
  } catch {
    return { success: false, message: 'You do not have permission to reject commission and fee rules.' };
  }

  if (!isNonEmptyString(reviewNotes)) {
    return { success: false, message: 'A reason is required to reject a rule.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_commission_fee_rule', {
    p_rule_id: ruleId,
    p_review_notes: reviewNotes.trim(),
  });
  if (error) {
    console.error('Failed to reject commission fee rule', ruleId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'reject',
    module: 'commission_fee_rules',
    recordId: ruleId,
    newValue: { reviewNotes },
  });

  revalidatePath('/admin/commission-rules');
  revalidatePath(`/admin/commission-rules/${ruleId}`);
  revalidatePath('/admin/commission-rules/pending');
  return { success: true, ruleId };
}

export async function expireCommissionFeeRule(ruleId: string, expiryDate: string, expiryReason: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('commission_rules.approve');
  } catch {
    return { success: false, message: 'You do not have permission to expire commission and fee rules.' };
  }

  if (!isNonEmptyString(expiryReason)) {
    return { success: false, message: 'A reason is required to expire a rule.' };
  }
  if (!isNonEmptyString(expiryDate)) {
    return { success: false, message: 'An expiry date is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('expire_commission_fee_rule', {
    p_rule_id: ruleId,
    p_expiry_date: expiryDate,
    p_expiry_reason: expiryReason.trim(),
  });
  if (error) {
    console.error('Failed to expire commission fee rule', ruleId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'expire',
    module: 'commission_fee_rules',
    recordId: ruleId,
    newValue: { expiryDate, expiryReason },
  });

  revalidatePath('/admin/commission-rules');
  revalidatePath(`/admin/commission-rules/${ruleId}`);
  revalidatePath('/admin/commission-rules/scheduled');
  return { success: true, ruleId };
}

export interface CalculationPreviewResult {
  success: boolean;
  message?: string;
  ruleId?: string;
  ruleSummary?: string;
  result?: ReturnType<typeof calculateCommission>;
}

// Confidential by construction: this only ever runs for a caller who
// already holds commission_rules.view (Super Admin / Finance), and it
// returns a computed result plus a short rule summary — never the raw list
// of candidate rules or any other merchant's rates.
export async function previewCommissionCalculation(
  merchantId: string | null,
  serviceKey: string | null,
  grossAmount: string,
  asOfDate: string
): Promise<CalculationPreviewResult> {
  try {
    await requirePermission('commission_rules.view');
  } catch {
    return { success: false, message: 'You do not have permission to view commission and fee rules.' };
  }

  if (!isValidMoneyString(grossAmount)) {
    return { success: false, message: 'Enter a valid amount (up to 2 decimal places).' };
  }
  if (!isNonEmptyString(asOfDate)) {
    return { success: false, message: 'An as-of date is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('commission_fee_rules').select('*').eq('status', 'approved');
  if (error) {
    console.error('Failed to load commission fee rules for preview', error);
    return { success: false, message: 'Failed to load applicable rules.' };
  }

  const applicable = resolveApplicableCommissionRule((data ?? []) as CommissionFeeRule[], {
    merchantId,
    serviceKey,
    asOfDate,
  });
  if (!applicable) {
    return { success: false, message: 'No approved commission rule applies to this merchant/service on the given date.' };
  }

  let tiers: CommissionTier[] = [];
  if (applicable.commission_type === 'tiered') {
    const { data: tierRows } = await supabase
      .from('commission_fee_rule_tiers')
      .select('*')
      .eq('rule_id', applicable.id)
      .order('tier_order', { ascending: true });
    tiers = (tierRows ?? []).map((t) => ({
      tierOrder: t.tier_order,
      minAmount: t.min_amount,
      maxAmount: t.max_amount,
      tierPercentage: t.tier_percentage,
    }));
  }

  const ruleInput: CommissionRuleInput = {
    commissionType: applicable.commission_type,
    percentageRate: applicable.percentage_rate,
    fixedFeeAmount: applicable.fixed_fee_amount,
    minimumFee: applicable.minimum_fee,
    maximumFee: applicable.maximum_fee,
    settlementFee: applicable.settlement_fee,
    monthlyTechnologyFee: applicable.monthly_technology_fee,
    tiers,
  };

  try {
    const result = calculateCommission(ruleInput, grossAmount);
    return {
      success: true,
      ruleId: applicable.id,
      ruleSummary: `${applicable.commission_type} rule, version ${applicable.version_number}, effective ${applicable.effective_date}`,
      result,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Calculation failed.' };
  }
}
