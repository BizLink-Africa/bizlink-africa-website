'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { isValidMoneyString } from '@/lib/collections/money';
import { parseCollectionStatementCsv } from '@/lib/collections/csv-parser';
import { SandboxProviderAdapter, type ProviderTransactionRow } from '@/lib/collections/provider-adapter';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface ImportResult {
  success: boolean;
  message?: string;
  imported?: number;
  duplicates?: number;
  rowErrors?: { row: number; message: string }[];
}

// The only write path for collection_transactions rows. Each row's
// provider_transaction_reference is checked against every existing row
// before insert — a match is still inserted (never silently dropped) but
// flagged reconciliation_status='duplicate' and settlement_eligibility is
// structurally forced to false by the DB CHECK constraint regardless of
// what this action does.
async function importRows(rows: ProviderTransactionRow[], sourceFileReference: string, mode: 'manual_import' | 'sandbox'): Promise<ImportResult> {
  let user;
  try {
    user = await requirePermission('collections.manage');
  } catch {
    return { success: false, message: 'You do not have permission to import collection statements.' };
  }

  if (rows.length === 0) {
    return { success: false, message: 'No valid rows to import.' };
  }

  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from('collection_import_batches')
    .insert({
      source_file_reference: sourceFileReference,
      provider_name: mode === 'sandbox' ? 'Sandbox' : 'Manual Import',
      mode,
      row_count: rows.length,
      imported_by: user.email ?? 'unknown',
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    console.error('Failed to create import batch', batchError);
    return { success: false, message: 'Failed to record the import batch.' };
  }

  let imported = 0;
  let duplicates = 0;

  for (const row of rows) {
    const { data: existing } = await supabase
      .from('collection_transactions')
      .select('id')
      .eq('provider_transaction_reference', row.providerTransactionReference)
      .limit(1)
      .maybeSingle();

    let merchantId: string | null = null;
    if (row.tillReference) {
      const { data: till } = await supabase
        .from('merchant_tills')
        .select('merchant_id')
        .eq('partner_till_reference', row.tillReference)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      merchantId = till?.merchant_id ?? null;
    }

    const isDuplicate = !!existing;
    if (isDuplicate) duplicates += 1;
    else imported += 1;

    const { error: insertError } = await supabase.from('collection_transactions').insert({
      provider_transaction_reference: row.providerTransactionReference,
      merchant_id: merchantId,
      till_reference: row.tillReference,
      payer_reference_masked: row.payerReferenceMasked,
      // Money values are the original decimal strings — never parsed to a
      // JS number here. Postgres's numeric(14,2) column parses them
      // exactly.
      gross_amount: row.grossAmount,
      currency: row.currency,
      provider_fee: row.providerFee,
      transaction_status: row.transactionStatus,
      reversal_status: row.reversalStatus ?? 'none',
      chargeback_status: row.chargebackStatus ?? 'none',
      collected_at: row.collectedAt,
      source_file_reference: sourceFileReference,
      import_batch_id: batch.id,
      reconciliation_status: isDuplicate ? 'duplicate' : 'unmatched',
      duplicate_of_transaction_id: isDuplicate ? existing!.id : null,
      created_by: user.email ?? 'unknown',
    });

    if (insertError) {
      console.error('Failed to insert collection transaction', row.providerTransactionReference, insertError);
    }
  }

  // Audit log carries counts and the batch reference only — never the
  // parsed transaction data itself.
  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'import_statement',
    module: 'collection_import_batches',
    recordId: batch.id,
    newValue: { sourceFileReference, mode, imported, duplicates, totalRows: rows.length },
  });

  revalidatePath('/admin/merchant-operations/collections');
  return { success: true, imported, duplicates };
}

export async function importCollectionStatementCsv(formData: FormData): Promise<ImportResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: 'Please select a CSV file.' };
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { success: false, message: 'Only .csv files are accepted.' };
  }
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, message: 'File is too large (max 10MB).' };
  }

  const text = await file.text();
  const { rows, errors } = parseCollectionStatementCsv(text);

  if (rows.length === 0) {
    return { success: false, message: 'No valid rows found in the file.', rowErrors: errors };
  }

  const result = await importRows(rows, file.name, 'manual_import');
  return { ...result, rowErrors: errors };
}

// Sandbox mode: generates deterministic synthetic rows via
// SandboxProviderAdapter — no real provider connection, clearly labeled.
export async function importSandboxStatement(fromDate: string, toDate: string): Promise<ImportResult> {
  const adapter = new SandboxProviderAdapter();
  const rows = await adapter.fetchStatement({ from: fromDate, to: toDate });
  return importRows(rows, `sandbox:${fromDate}:${toDate}`, 'sandbox');
}

export async function requestManualAdjustment(
  transactionId: string,
  adjustmentAmount: string,
  reason: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('collections.manage');
  } catch {
    return { success: false, message: 'You do not have permission to request manual adjustments.' };
  }

  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required.' };
  }
  // Allows a leading "-" for a negative adjustment (a correction reducing
  // net amount) — validated as shape only, never parsed for storage.
  if (!isValidMoneyString(adjustmentAmount.replace(/^-/, ''))) {
    return { success: false, message: 'Invalid adjustment amount.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('collection_manual_adjustments').insert({
    transaction_id: transactionId,
    adjustment_amount: adjustmentAmount,
    reason: reason.trim().slice(0, 500),
    requested_by: user.email ?? 'unknown',
  });

  if (error) {
    console.error('Failed to request manual adjustment', transactionId, error);
    return { success: false, message: 'Failed to submit the adjustment request.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'request_manual_adjustment',
    module: 'collection_manual_adjustments',
    recordId: transactionId,
    newValue: { adjustmentAmount, reason },
  });

  revalidatePath('/admin/merchant-operations/collections');
  return { success: true };
}

export async function reviewManualAdjustment(
  adjustmentId: string,
  transactionId: string,
  decision: 'approve' | 'reject',
  reviewNotes: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('collections.approve');
  } catch {
    return { success: false, message: 'You do not have permission to review manual adjustments.' };
  }

  if (decision === 'reject' && !isNonEmptyString(reviewNotes)) {
    return { success: false, message: 'A reason is required to reject an adjustment.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    decision === 'approve' ? 'apply_collection_manual_adjustment' : 'reject_collection_manual_adjustment',
    { p_adjustment_id: adjustmentId, p_review_notes: reviewNotes?.trim() || null }
  );

  if (error) {
    console.error('Failed to review manual adjustment', adjustmentId, error);
    return { success: false, message: error.message ?? 'Failed to review the adjustment.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `manual_adjustment_${decision}d`,
    module: 'collection_manual_adjustments',
    recordId: transactionId,
    newValue: { reviewNotes },
  });

  revalidatePath('/admin/merchant-operations/collections');
  return { success: true };
}
