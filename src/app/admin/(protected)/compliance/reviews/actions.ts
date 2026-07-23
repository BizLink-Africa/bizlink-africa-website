'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { ComplianceCategory, ComplianceStatus, RiskLevel } from '@/data/compliance';

const MAX_TEXT_LENGTH = 200;

export interface ComplianceReviewInput {
  title: string;
  category: ComplianceCategory;
  relatedClientId?: string;
  department?: string;
  reviewer?: string;
  startDate?: string;
  dueDate?: string;
  riskLevel?: RiskLevel;
  notes?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createComplianceReview(input: ComplianceReviewInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('compliance.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create compliance reviews.' };
  }

  if (!isNonEmptyString(input.title)) {
    return { success: false, message: 'Title is required.' };
  }

  const supabase = await createClient();
  const { data: reviewNumber } = await supabase.rpc('next_finance_number', { seq_prefix: 'CR' });

  const { data, error } = await supabase
    .from('compliance_reviews')
    .insert({
      review_number: reviewNumber ?? null,
      title: input.title.trim().slice(0, MAX_TEXT_LENGTH),
      category: input.category,
      related_client_id: input.relatedClientId || null,
      department: input.department?.trim() || null,
      reviewer: input.reviewer?.trim() || null,
      start_date: input.startDate || null,
      due_date: input.dueDate || null,
      risk_level: input.riskLevel || null,
      notes: input.notes?.trim() || null,
      status: 'pending',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create compliance review', error);
    return { success: false, message: 'Failed to create compliance review.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'compliance_reviews',
    recordId: data.id,
    newValue: { title: input.title, category: input.category },
  });

  revalidatePath('/admin/compliance/reviews');
  revalidatePath('/admin/compliance');
  return { success: true, id: data.id };
}

export interface ComplianceReviewUpdateInput {
  status: ComplianceStatus;
  findings?: string;
  riskLevel?: RiskLevel;
  correctiveActions?: string;
  correctiveActionDueDate?: string;
  evidence?: string;
}

export async function updateComplianceReview(
  id: string,
  input: ComplianceReviewUpdateInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('compliance.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update compliance reviews.' };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { status: input.status };
  if (input.findings !== undefined) updates.findings = input.findings.trim() || null;
  if (input.riskLevel !== undefined) updates.risk_level = input.riskLevel || null;
  if (input.correctiveActions !== undefined) updates.corrective_actions = input.correctiveActions.trim() || null;
  if (input.correctiveActionDueDate !== undefined) updates.corrective_action_due_date = input.correctiveActionDueDate || null;
  if (input.evidence !== undefined) updates.evidence = input.evidence.trim() || null;
  if (input.status === 'compliant' || input.status === 'non_compliant') {
    updates.completed_date = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase.from('compliance_reviews').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update compliance review', id, error);
    return { success: false, message: 'Failed to update compliance review.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${input.status}`,
    module: 'compliance_reviews',
    recordId: id,
    newValue: input,
  });

  revalidatePath('/admin/compliance/reviews');
  revalidatePath('/admin/compliance');
  return { success: true };
}
