'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { isValidMoneyString } from '@/lib/collections/money';
import { assertArchivedFinancialPrototypeReadOnly } from '@/lib/archived-financial-prototype';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface ActionResult {
  success: boolean;
  message?: string;
  id?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Chargeback cases
// ═══════════════════════════════════════════════════════════════════════

export async function openChargebackCase(
  transactionId: string,
  disputedAmount: string,
  associatedFee: string,
  reason: string,
  evidenceDueAt: string | null
): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to open a chargeback case.' };
  }
  if (!isValidMoneyString(disputedAmount)) {
    return { success: false, message: 'Invalid disputed amount.' };
  }
  if (associatedFee && !isValidMoneyString(associatedFee)) {
    return { success: false, message: 'Invalid associated fee.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('open_chargeback_case', {
    p_transaction_id: transactionId,
    p_disputed_amount: disputedAmount,
    p_associated_fee: associatedFee || '0',
    p_reason: reason,
    p_evidence_due_at: evidenceDueAt,
  });

  if (error) {
    console.error('Failed to open chargeback case', transactionId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'open_case',
    module: 'chargeback_cases',
    recordId: data as string,
    newValue: { transactionId, disputedAmount, reason },
  });

  revalidatePath('/admin/chargebacks');
  return { success: true, id: data as string };
}

export async function requestChargebackEvidence(caseId: string, evidenceDueAt: string | null): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to request evidence.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('request_chargeback_evidence', { p_case_id: caseId, p_evidence_due_at: evidenceDueAt });
  if (error) {
    console.error('Failed to request chargeback evidence', caseId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'request_evidence', module: 'chargeback_cases', recordId: caseId });
  revalidatePath(`/admin/chargebacks/${caseId}`);
  return { success: true, id: caseId };
}

export async function submitChargebackEvidence(caseId: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to submit evidence.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_chargeback_evidence', { p_case_id: caseId });
  if (error) {
    console.error('Failed to submit chargeback evidence', caseId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'submit_evidence', module: 'chargeback_cases', recordId: caseId });
  revalidatePath(`/admin/chargebacks/${caseId}`);
  return { success: true, id: caseId };
}

export async function upsertEvidenceItem(caseId: string, evidenceType: string, status: string, notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage evidence items.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('chargeback_evidence_items').upsert(
    {
      case_id: caseId,
      evidence_type: evidenceType,
      status,
      notes: notes?.trim() || null,
      submitted_by: status === 'submitted' ? user.email ?? 'unknown' : null,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    },
    { onConflict: 'case_id,evidence_type' }
  );

  if (error) {
    console.error('Failed to upsert chargeback evidence item', caseId, evidenceType, error);
    return { success: false, message: 'Failed to save evidence item.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_evidence_item',
    module: 'chargeback_cases',
    recordId: caseId,
    newValue: { evidenceType, status },
  });

  revalidatePath(`/admin/chargebacks/${caseId}`);
  return { success: true, id: caseId };
}

export async function beginChargebackReview(caseId: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.resolve');
  } catch {
    return { success: false, message: 'You do not have permission to move a case to review.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('begin_chargeback_review', { p_case_id: caseId });
  if (error) {
    console.error('Failed to begin chargeback review', caseId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'begin_review', module: 'chargeback_cases', recordId: caseId });
  revalidatePath(`/admin/chargebacks/${caseId}`);
  return { success: true, id: caseId };
}

export async function resolveChargebackCase(caseId: string, outcome: 'won' | 'lost' | 'withdrawn', notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.resolve');
  } catch {
    return { success: false, message: 'You do not have permission to resolve a case.' };
  }
  if (!isNonEmptyString(notes)) {
    return { success: false, message: 'Resolution notes are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_chargeback_case', { p_case_id: caseId, p_outcome: outcome, p_resolution_notes: notes.trim() });
  if (error) {
    console.error('Failed to resolve chargeback case', caseId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: `resolve_${outcome}`, module: 'chargeback_cases', recordId: caseId, newValue: { notes } });
  revalidatePath(`/admin/chargebacks/${caseId}`);
  revalidatePath('/admin/chargebacks');
  return { success: true, id: caseId };
}

export async function closeChargebackCase(caseId: string, notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.resolve');
  } catch {
    return { success: false, message: 'You do not have permission to close a case.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('close_chargeback_case', { p_case_id: caseId, p_notes: notes?.trim() || null });
  if (error) {
    console.error('Failed to close chargeback case', caseId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'close_case', module: 'chargeback_cases', recordId: caseId });
  revalidatePath(`/admin/chargebacks/${caseId}`);
  revalidatePath('/admin/chargebacks');
  return { success: true, id: caseId };
}

// "Recovery entries require audit logs" — logAuditEvent() below is not
// optional decoration, it's the literal requirement.
export async function recordChargebackRecovery(
  caseId: string,
  recoveryAmount: string,
  recoveryMethod: string,
  notes: string
): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('chargebacks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record a recovery.' };
  }
  if (!isValidMoneyString(recoveryAmount)) {
    return { success: false, message: 'Invalid recovery amount.' };
  }
  if (recoveryMethod === 'settlement_deduction') {
    return {
      success: false,
      message: 'Settlement deduction is no longer a valid recovery method. BizLink Africa does not receive, hold or settle merchant funds.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_chargeback_recovery', {
    p_case_id: caseId,
    p_recovery_amount: recoveryAmount,
    p_recovery_method: recoveryMethod,
    p_notes: notes?.trim() || null,
  });
  if (error) {
    console.error('Failed to record chargeback recovery', caseId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'record_recovery',
    module: 'chargeback_cases',
    recordId: caseId,
    newValue: { recoveryAmount, recoveryMethod, notes },
  });

  revalidatePath(`/admin/chargebacks/${caseId}`);
  return { success: true, id: caseId };
}

// ═══════════════════════════════════════════════════════════════════════
// Settlement holds
// ═══════════════════════════════════════════════════════════════════════

export async function placeSettlementHold(
  merchantId: string,
  transactionId: string | null,
  batchId: string | null,
  holdReason: string,
  holdAmount: string,
  expiresAt: string | null
): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('holds.manage');
  } catch {
    return { success: false, message: 'You do not have permission to place a settlement hold.' };
  }
  if (!isNonEmptyString(holdReason)) {
    return { success: false, message: 'A reason is required to place a hold.' };
  }
  if (holdAmount && !isValidMoneyString(holdAmount)) {
    return { success: false, message: 'Invalid hold amount.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('place_settlement_hold', {
    p_merchant_id: merchantId,
    p_transaction_id: transactionId,
    p_batch_id: batchId,
    p_hold_reason: holdReason.trim(),
    p_hold_amount: holdAmount || '0',
    p_expires_at: expiresAt,
  });

  if (error) {
    console.error('Failed to place settlement hold', merchantId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'place_hold',
    module: 'settlement_holds',
    recordId: data as string,
    newValue: { merchantId, transactionId, batchId, holdReason, holdAmount },
  });

  revalidatePath('/admin/chargebacks/holds');
  return { success: true, id: data as string };
}

export async function requestSettlementHoldRelease(holdId: string, reason: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('holds.manage');
  } catch {
    return { success: false, message: 'You do not have permission to request a hold release.' };
  }
  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required to request a hold release.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('request_settlement_hold_release', { p_hold_id: holdId, p_reason: reason.trim() });
  if (error) {
    console.error('Failed to request settlement hold release', holdId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'request_release', module: 'settlement_holds', recordId: holdId, newValue: { reason } });
  revalidatePath('/admin/chargebacks/holds');
  revalidatePath(`/admin/chargebacks/holds/${holdId}`);
  return { success: true, id: holdId };
}

export async function approveSettlementHoldRelease(holdId: string, notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('holds.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve a hold release.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_settlement_hold_release', { p_hold_id: holdId, p_notes: notes?.trim() || null });
  if (error) {
    console.error('Failed to approve settlement hold release', holdId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'approve_release', module: 'settlement_holds', recordId: holdId, newValue: { notes } });
  revalidatePath('/admin/chargebacks/holds');
  revalidatePath(`/admin/chargebacks/holds/${holdId}`);
  return { success: true, id: holdId };
}

export async function rejectSettlementHoldRelease(holdId: string, notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('holds.approve');
  } catch {
    return { success: false, message: 'You do not have permission to reject a hold release.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_settlement_hold_release', { p_hold_id: holdId, p_notes: notes?.trim() || null });
  if (error) {
    console.error('Failed to reject settlement hold release', holdId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'reject_release', module: 'settlement_holds', recordId: holdId, newValue: { notes } });
  revalidatePath('/admin/chargebacks/holds');
  revalidatePath(`/admin/chargebacks/holds/${holdId}`);
  return { success: true, id: holdId };
}

// ═══════════════════════════════════════════════════════════════════════
// Manual reversals
// ═══════════════════════════════════════════════════════════════════════

export async function requestManualReversal(
  transactionId: string,
  reversalAmount: string,
  reason: string,
  linkedChargebackCaseId: string | null
): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('reversals.manage');
  } catch {
    return { success: false, message: 'You do not have permission to request a manual reversal.' };
  }
  if (!isValidMoneyString(reversalAmount)) {
    return { success: false, message: 'Invalid reversal amount.' };
  }
  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_manual_reversal', {
    p_transaction_id: transactionId,
    p_reversal_amount: reversalAmount,
    p_reason: reason.trim(),
    p_linked_chargeback_case_id: linkedChargebackCaseId,
  });

  if (error) {
    console.error('Failed to request manual reversal', transactionId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'request_reversal',
    module: 'manual_reversal_requests',
    recordId: data as string,
    newValue: { transactionId, reversalAmount, reason },
  });

  revalidatePath('/admin/chargebacks/reversals');
  return { success: true, id: data as string };
}

export async function approveManualReversal(requestId: string, notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('reversals.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve a manual reversal.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_manual_reversal', { p_request_id: requestId, p_notes: notes?.trim() || null });
  if (error) {
    console.error('Failed to approve manual reversal', requestId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'approve_reversal', module: 'manual_reversal_requests', recordId: requestId, newValue: { notes } });
  revalidatePath('/admin/chargebacks/reversals');
  return { success: true, id: requestId };
}

export async function rejectManualReversal(requestId: string, notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('reversals.approve');
  } catch {
    return { success: false, message: 'You do not have permission to reject a manual reversal.' };
  }
  if (!isNonEmptyString(notes)) {
    return { success: false, message: 'A reason is required to reject a manual reversal.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_manual_reversal', { p_request_id: requestId, p_notes: notes.trim() });
  if (error) {
    console.error('Failed to reject manual reversal', requestId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'reject_reversal', module: 'manual_reversal_requests', recordId: requestId, newValue: { notes } });
  revalidatePath('/admin/chargebacks/reversals');
  return { success: true, id: requestId };
}
