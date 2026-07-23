'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { TAX_CATEGORIES, TAX_FILING_STATUSES, type TaxCategory, type TaxFilingStatus } from '@/data/finance';

const MAX_TEXT_LENGTH = 200;
const VALID_CATEGORIES = new Set<string>(TAX_CATEGORIES.map((c) => c.value));
const VALID_FILING_STATUSES = new Set<string>(TAX_FILING_STATUSES.map((s) => s.value));

export interface TaxRecordInput {
  taxPeriod: string;
  taxCategory: TaxCategory;
  taxableAmount: number;
  taxAmount: number;
  reference?: string;
  notes?: string;
}

export async function createTaxRecord(input: TaxRecordInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('tax_records.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create tax records.' };
  }

  if (!input.taxPeriod?.trim()) {
    return { success: false, message: 'Tax period is required.' };
  }
  if (!VALID_CATEGORIES.has(input.taxCategory)) {
    return { success: false, message: 'Invalid tax category.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tax_records')
    .insert({
      tax_period: input.taxPeriod.trim().slice(0, 50),
      tax_category: input.taxCategory,
      taxable_amount: input.taxableAmount,
      tax_amount: input.taxAmount,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      filing_status: 'pending',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create tax record', error);
    return { success: false, message: 'Failed to create tax record.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'tax_records',
    recordId: data.id,
    newValue: { taxPeriod: input.taxPeriod, taxCategory: input.taxCategory },
  });

  revalidatePath('/admin/finance/tax-records');
  return { success: true, id: data.id };
}

export async function updateTaxRecordFilingStatus(id: string, filingStatus: TaxFilingStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('tax_records.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update tax records.' };
  }

  if (!VALID_FILING_STATUSES.has(filingStatus)) {
    return { success: false, message: 'Invalid filing status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('tax_records').update({ filing_status: filingStatus }).eq('id', id);

  if (error) {
    console.error('Failed to update tax record filing status', id, error);
    return { success: false, message: 'Failed to update filing status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'status_change',
    module: 'tax_records',
    recordId: id,
    newValue: { filingStatus },
  });

  revalidatePath('/admin/finance/tax-records');
  return { success: true };
}

// Single-argument, string-in wrapper so InlineSelect (a Client Component)
// can bind it directly — onSave={updateTaxRecordFilingStatusOption.bind(null, r.id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component. The cast is
// safe: updateTaxRecordFilingStatus re-validates against
// VALID_FILING_STATUSES before writing anything.
export async function updateTaxRecordFilingStatusOption(id: string, value: string): Promise<{ success: boolean; message?: string }> {
  return updateTaxRecordFilingStatus(id, value as TaxFilingStatus);
}
