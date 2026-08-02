'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { hasRecentReauth, SETTLEMENT_EMERGENCY_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import { logAuditEvent } from '@/lib/audit';
import { SandboxPayoutAdapter } from '@/lib/settlement/payout-adapter';
import { refreshSelcomBalance } from '@/lib/selcom/balance-service';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface ActionResult {
  success: boolean;
  message?: string;
  batchId?: string;
}

// The only way a settlement batch is created. Runs the 12 pre-settlement
// checks server-side inside prepare_settlement_batch() — nothing about
// eligibility is decided or trusted from the client.
export async function prepareSettlementBatch(settlementDate: string, merchantId: string | null): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.prepare');
  } catch {
    return { success: false, message: 'You do not have permission to prepare settlement batches.' };
  }
  if (!isNonEmptyString(settlementDate)) {
    return { success: false, message: 'A settlement date is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('prepare_settlement_batch', {
    p_settlement_date: settlementDate,
    p_merchant_id: merchantId,
  });

  if (error) {
    console.error('Failed to prepare settlement batch', error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'prepare',
    module: 'settlement_batches',
    recordId: data as string,
    newValue: { settlementDate, merchantId },
  });

  revalidatePath('/admin/settlement');
  return { success: true, batchId: data as string };
}

export async function submitSettlementBatchForReview(batchId: string, varianceResolutionNotes: string | null): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.prepare');
  } catch {
    return { success: false, message: 'You do not have permission to submit settlement batches.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_settlement_batch_for_review', {
    p_batch_id: batchId,
    p_variance_resolution_notes: varianceResolutionNotes?.trim() || null,
  });

  if (error) {
    console.error('Failed to submit settlement batch', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'submit_for_review',
    module: 'settlement_batches',
    recordId: batchId,
    newValue: { varianceResolutionNotes },
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, batchId };
}

export async function reviewSettlementBatch(batchId: string, reviewNotes: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.review');
  } catch {
    return { success: false, message: 'You do not have permission to review settlement batches.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('review_settlement_batch', {
    p_batch_id: batchId,
    p_review_notes: reviewNotes?.trim() || null,
  });

  if (error) {
    console.error('Failed to review settlement batch', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'review',
    module: 'settlement_batches',
    recordId: batchId,
    newValue: { reviewNotes },
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, batchId };
}

export async function rejectSettlementBatch(batchId: string, rejectionReason: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.review');
  } catch {
    return { success: false, message: 'You do not have permission to reject settlement batches.' };
  }
  if (!isNonEmptyString(rejectionReason)) {
    return { success: false, message: 'A reason is required to reject a settlement batch.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_settlement_batch', {
    p_batch_id: batchId,
    p_rejection_reason: rejectionReason.trim(),
  });

  if (error) {
    console.error('Failed to reject settlement batch', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'reject',
    module: 'settlement_batches',
    recordId: batchId,
    newValue: { rejectionReason },
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, batchId };
}

// Before a batch can be approved, this app must confirm — with a FRESH
// live balance, never the cached snapshot — that the Selcom disbursement
// account can actually cover it, and reserve that amount so a second
// batch's approval can't assume the same funds are available. See
// reserve_selcom_balance_for_batch() in
// 20260822000000_selcom_disbursement_balance.sql for the row-locked guard
// that makes the reservation atomic with finalising approval. A balance
// check is always recorded here (trigger_type = 'batch_approval'),
// whether or not the approval itself goes on to succeed.
export async function approveSettlementBatch(batchId: string, approvalNotes: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve settlement batches.' };
  }

  const supabase = await createClient();

  const balance = await refreshSelcomBalance(supabase, {
    triggerType: 'batch_approval',
    batchId,
    performedBy: user.email ?? 'unknown',
  });
  if (!balance.querySucceeded || balance.availableBalance === null) {
    return {
      success: false,
      message: `Could not confirm the Selcom disbursement balance before approval — refusing to approve without it. ${balance.errorMessage ?? ''}`.trim(),
    };
  }

  const { error } = await supabase.rpc('approve_settlement_batch', {
    p_batch_id: batchId,
    p_approval_notes: approvalNotes?.trim() || null,
    p_available_balance: balance.availableBalance,
  });

  if (error) {
    console.error('Failed to approve settlement batch', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'approve',
    module: 'settlement_batches',
    recordId: batchId,
    newValue: { approvalNotes },
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  revalidatePath('/admin/settings/integrations/selcom');
  return { success: true, batchId };
}

export async function placeSettlementBatchHold(batchId: string, reason: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.compliance_hold');
  } catch {
    return { success: false, message: 'You do not have permission to place a compliance hold.' };
  }
  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required to place a compliance hold.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('place_settlement_batch_hold', { p_batch_id: batchId, p_reason: reason.trim() });

  if (error) {
    console.error('Failed to place settlement batch hold', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'compliance_hold_placed',
    module: 'settlement_batches',
    recordId: batchId,
    newValue: { reason },
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, batchId };
}

export async function releaseSettlementBatchHold(batchId: string, notes: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.compliance_hold');
  } catch {
    return { success: false, message: 'You do not have permission to release a compliance hold.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('release_settlement_batch_hold', { p_batch_id: batchId, p_notes: notes?.trim() || null });

  if (error) {
    console.error('Failed to release settlement batch hold', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'compliance_hold_released',
    module: 'settlement_batches',
    recordId: batchId,
    newValue: { notes },
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, batchId };
}

export async function emergencyCancelSettlementBatch(batchId: string, reason: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.emergency');
  } catch {
    return { success: false, message: 'You do not have permission to perform an emergency cancellation.' };
  }
  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required for an emergency cancellation.' };
  }
  if (!(await hasRecentReauth(SETTLEMENT_EMERGENCY_REAUTH_PURPOSE))) {
    return { success: false, message: 'Re-authentication required before an emergency override. Please refresh and confirm your password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('emergency_cancel_settlement_batch', { p_batch_id: batchId, p_reason: reason.trim() });

  if (error) {
    console.error('Failed to emergency-cancel settlement batch', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'emergency_cancel',
    module: 'settlement_batches',
    recordId: batchId,
    newValue: { reason },
    reason,
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, batchId };
}

// Moves an approved batch into 'processing', then runs every pending line
// through the sandbox/mock payout adapter — never a real disbursement call
// — recording each outcome via apply_settlement_line_payout_result(),
// which is also the only place the batch's final status is derived.
export async function processSettlementBatch(batchId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission('settlement.process');
  } catch {
    return { success: false, message: 'You do not have permission to process settlement batches.' };
  }

  const supabase = await createClient();
  const { error: beginError } = await supabase.rpc('begin_settlement_batch_processing', { p_batch_id: batchId });
  if (beginError) {
    console.error('Failed to begin settlement batch processing', batchId, beginError);
    return { success: false, message: beginError.message };
  }

  const { data: lines, error: linesError } = await supabase
    .from('settlement_batch_lines')
    .select('*')
    .eq('batch_id', batchId)
    .eq('payout_status', 'processing');

  if (linesError) {
    console.error('Failed to load settlement batch lines for processing', batchId, linesError);
    return { success: false, message: 'Failed to load batch lines for processing.' };
  }

  const adapter = new SandboxPayoutAdapter();
  const { data: batch } = await supabase.from('settlement_batches').select('id').eq('id', batchId).maybeSingle();

  for (const line of lines ?? []) {
    const result = await adapter.payOut({
      batchId,
      lineId: line.id,
      merchantId: line.merchant_id,
      beneficiaryId: line.beneficiary_id,
      amount: line.net_amount,
      currency: 'TZS',
    });

    const { error: resultError } = await supabase.rpc('apply_settlement_line_payout_result', {
      p_line_id: line.id,
      p_status: result.status,
      p_payout_reference: result.payoutReference,
      p_failure_reason: result.failureReason,
    });
    if (resultError) {
      console.error('Failed to apply settlement line payout result', line.id, resultError);
    }
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'process',
    module: 'settlement_batches',
    recordId: batch?.id ?? batchId,
    newValue: { lineCount: lines?.length ?? 0, adapter: adapter.name },
  });

  revalidatePath('/admin/settlement');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, batchId };
}
