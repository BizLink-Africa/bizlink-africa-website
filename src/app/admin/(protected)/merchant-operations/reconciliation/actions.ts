'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { isValidMoneyString } from '@/lib/collections/money';

export interface RunReconciliationInput {
  fromDate: string;
  toDate: string;
  tillReference?: string;
  merchantId?: string;
  vendorAmountReceived?: string;
}

// All totals and matching decisions are computed inside
// run_collection_reconciliation() (Postgres SUM/CASE, exact numeric) — this
// action never sums or compares monetary values itself.
export async function runDailyReconciliation(input: RunReconciliationInput): Promise<{ success: boolean; message?: string; runId?: string }> {
  let user;
  try {
    user = await requirePermission('collections.reconcile');
  } catch {
    return { success: false, message: 'You do not have permission to run reconciliation.' };
  }

  if (!input.fromDate || !input.toDate) {
    return { success: false, message: 'A date range is required.' };
  }
  if (input.vendorAmountReceived && !isValidMoneyString(input.vendorAmountReceived)) {
    return { success: false, message: 'Invalid vendor amount received.' };
  }

  const supabase = await createClient();
  const { data: runId, error } = await supabase.rpc('run_collection_reconciliation', {
    p_from_date: input.fromDate,
    p_to_date: input.toDate,
    p_till_reference: input.tillReference || null,
    p_merchant_id: input.merchantId || null,
    p_vendor_amount_received: input.vendorAmountReceived || null,
    p_created_by: user.email ?? 'unknown',
  });

  if (error || !runId) {
    console.error('Failed to run reconciliation', error);
    return { success: false, message: error?.message ?? 'Failed to run reconciliation.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'run_reconciliation',
    module: 'collection_reconciliation_runs',
    recordId: runId as string,
    newValue: { fromDate: input.fromDate, toDate: input.toDate, tillReference: input.tillReference ?? null, merchantId: input.merchantId ?? null },
  });

  revalidatePath('/admin/merchant-operations/reconciliation');
  return { success: true, runId: runId as string };
}

// The only way settlement_eligibility ever becomes true — see
// approve_collection_reconciliation_run() in the migration. Once applied,
// the run row is immutable (enforced by a DB trigger, not just this
// action).
export async function approveReconciliationRun(runId: string, approvalNotes: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('collections.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve reconciliation runs.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_collection_reconciliation_run', {
    p_run_id: runId,
    p_approval_notes: approvalNotes?.trim() || null,
  });

  if (error) {
    console.error('Failed to approve reconciliation run', runId, error);
    return { success: false, message: error.message ?? 'Failed to approve the reconciliation run.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'approve_reconciliation_run',
    module: 'collection_reconciliation_runs',
    recordId: runId,
    newValue: { approvalNotes },
  });

  revalidatePath('/admin/merchant-operations/reconciliation');
  return { success: true };
}

// Moves a transaction into the unresolved-item queue for manual
// investigation — a deliberate, audited action, not a byproduct of the
// automated matching pass.
export async function flagTransactionUnderReview(transactionId: string, notes: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('collections.reconcile');
  } catch {
    return { success: false, message: 'You do not have permission to flag transactions for review.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('collection_transactions')
    .update({ reconciliation_status: 'under_review' })
    .eq('id', transactionId);

  if (error) {
    console.error('Failed to flag transaction under review', transactionId, error);
    return { success: false, message: 'Failed to flag the transaction.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'flag_under_review',
    module: 'collection_transactions',
    recordId: transactionId,
    newValue: { notes },
  });

  revalidatePath('/admin/merchant-operations/reconciliation');
  return { success: true };
}
