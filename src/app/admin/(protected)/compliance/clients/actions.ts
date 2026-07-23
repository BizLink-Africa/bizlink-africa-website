'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { CLIENT_COMPLIANCE_STATUSES } from '@/data/clientCompliance';
import { RISK_LEVELS } from '@/data/compliance';

const VALID_STATUSES = new Set<string>(CLIENT_COMPLIANCE_STATUSES.map((s) => s.value));
const VALID_RISK_LEVELS = new Set<string>(RISK_LEVELS.map((r) => r.value));

export interface ClientComplianceInput {
  clientId: string;
  complianceStatus: string;
  documentsReceived: string[];
  documentsPending: string[];
  reviewDate?: string;
  nextReviewDate?: string;
  riskLevel: string;
  notes?: string;
}

export async function upsertClientCompliance(input: ClientComplianceInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('client_compliance.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage client compliance.' };
  }

  if (!input.clientId) {
    return { success: false, message: 'A client is required.' };
  }
  if (!VALID_STATUSES.has(input.complianceStatus)) {
    return { success: false, message: 'Invalid compliance status.' };
  }
  if (!VALID_RISK_LEVELS.has(input.riskLevel)) {
    return { success: false, message: 'Invalid risk level.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_compliance')
    .insert({
      client_id: input.clientId,
      compliance_status: input.complianceStatus,
      documents_received: input.documentsReceived,
      documents_pending: input.documentsPending,
      review_date: input.reviewDate || null,
      next_review_date: input.nextReviewDate || null,
      risk_level: input.riskLevel,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to save client compliance record', error);
    return { success: false, message: 'Failed to save client compliance record.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'client_compliance',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/compliance/clients');
  revalidatePath('/admin/compliance');
  return { success: true };
}

export async function updateClientComplianceStatus(id: string, complianceStatus: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('client_compliance.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update client compliance.' };
  }

  if (!VALID_STATUSES.has(complianceStatus)) {
    return { success: false, message: 'Invalid compliance status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('client_compliance').update({ compliance_status: complianceStatus }).eq('id', id);

  if (error) {
    console.error('Failed to update client compliance status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'client_compliance',
    recordId: id,
    newValue: { complianceStatus },
  });

  revalidatePath('/admin/compliance/clients');
  revalidatePath('/admin/compliance');
  return { success: true };
}
