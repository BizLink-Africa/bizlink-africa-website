'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { RISK_LEVELS } from '@/data/compliance';

const VALID_RISK_LEVELS = new Set<string>(RISK_LEVELS.map((r) => r.value));

export interface DataProtectionActivityInput {
  processingActivity: string;
  dataCategory: string;
  purpose?: string;
  legalBasis?: string;
  retentionPeriod?: string;
  accessRoles: string[];
  riskLevel: string;
  reviewDate?: string;
}

export async function createDataProtectionActivity(input: DataProtectionActivityInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('data_protection.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage data protection activities.' };
  }

  if (!input.processingActivity?.trim() || !input.dataCategory?.trim()) {
    return { success: false, message: 'Processing activity and data category are required.' };
  }
  if (!VALID_RISK_LEVELS.has(input.riskLevel)) {
    return { success: false, message: 'Invalid risk level.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('data_protection_activities')
    .insert({
      processing_activity: input.processingActivity.trim(),
      data_category: input.dataCategory.trim(),
      purpose: input.purpose?.trim() || null,
      legal_basis: input.legalBasis?.trim() || null,
      retention_period: input.retentionPeriod?.trim() || null,
      access_roles: input.accessRoles,
      risk_level: input.riskLevel,
      review_date: input.reviewDate || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create data protection activity', error);
    return { success: false, message: 'Failed to save data protection activity.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'data_protection_activities',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/compliance/data-protection');
  revalidatePath('/admin/compliance');
  return { success: true };
}
