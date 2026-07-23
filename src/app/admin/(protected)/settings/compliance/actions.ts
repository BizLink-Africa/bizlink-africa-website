'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export interface ComplianceSettingsInput {
  reviewFrequencyDays: number;
  policyReviewPeriodDays: number;
}

export async function updateComplianceSettings(input: ComplianceSettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('compliance.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change compliance settings.' };
  }

  if (input.reviewFrequencyDays <= 0 || input.policyReviewPeriodDays <= 0) {
    return { success: false, message: 'Review periods must be greater than zero.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      compliance_review_frequency_days: input.reviewFrequencyDays,
      compliance_policy_review_period_days: input.policyReviewPeriodDays,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update compliance settings', error);
    return { success: false, message: 'Failed to save compliance settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings/compliance');
  return { success: true };
}

export async function setRequiredDocumentActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('compliance.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change compliance settings.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('compliance_required_documents').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update required document', id, error);
    return { success: false, message: 'Failed to save required document.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isActive ? 'activate' : 'deactivate',
    module: 'compliance_required_documents',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/settings/compliance');
  return { success: true };
}

// Single-argument, string-in wrapper so InlineSelect (a Client Component)
// can bind it directly — onSave={setRequiredDocumentActiveOption.bind(null, doc.id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component.
export async function setRequiredDocumentActiveOption(id: string, value: string): Promise<{ success: boolean; message?: string }> {
  return setRequiredDocumentActive(id, value === 'true');
}
