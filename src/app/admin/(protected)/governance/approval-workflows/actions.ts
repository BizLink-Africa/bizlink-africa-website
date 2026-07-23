'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { APPROVAL_CATEGORIES, APPROVAL_REQUEST_STATUSES, type ApprovalCategory } from '@/data/approvalWorkflows';

const MAX_TEXT_LENGTH = 200;
const VALID_CATEGORIES = new Set<string>(APPROVAL_CATEGORIES.map((c) => c.value));
const VALID_STATUSES = new Set<string>(APPROVAL_REQUEST_STATUSES.map((s) => s.value));

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function setWorkflowActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('approval_workflows.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage approval workflows.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('approval_workflows').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update approval workflow status', id, error);
    return { success: false, message: 'Failed to update workflow status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isActive ? 'activate' : 'deactivate',
    module: 'approval_workflows',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/governance/approval-workflows');
  revalidatePath('/admin/governance');
  return { success: true };
}

export async function updateWorkflowApprover(id: string, approverRole: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('approval_workflows.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage approval workflows.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('approval_workflows').update({ approver_role: approverRole }).eq('id', id);

  if (error) {
    console.error('Failed to update approval workflow approver', id, error);
    return { success: false, message: 'Failed to update approver.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_approver',
    module: 'approval_workflows',
    recordId: id,
    newValue: { approverRole },
  });

  revalidatePath('/admin/governance/approval-workflows');
  return { success: true };
}

export interface ApprovalRequestInput {
  category: ApprovalCategory;
  workflowId?: string;
  subjectLabel: string;
  amount?: number;
}

// Manually logged, same pattern as Technology's api_request_logs/
// background_jobs — this app has no live workflow engine wired into
// Contracts/Proformas/Invoices/Expenses, so raising a request here records
// intent to route something through a workflow; it never mutates the
// underlying contract/invoice/expense record itself.
export async function createApprovalRequest(input: ApprovalRequestInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('approval_workflows.view');
  } catch {
    return { success: false, message: 'You do not have permission to raise approval requests.' };
  }

  if (!VALID_CATEGORIES.has(input.category)) {
    return { success: false, message: 'Invalid category.' };
  }
  if (!isNonEmptyString(input.subjectLabel)) {
    return { success: false, message: 'A subject is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      workflow_id: input.workflowId || null,
      category: input.category,
      subject_label: input.subjectLabel.trim().slice(0, MAX_TEXT_LENGTH),
      amount: input.amount ?? null,
      requested_by: user.email ?? 'unknown',
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create approval request', error);
    return { success: false, message: 'Failed to create approval request.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'approval_requests',
    recordId: data.id,
    newValue: { category: input.category, subjectLabel: input.subjectLabel },
  });

  revalidatePath('/admin/governance/approval-workflows');
  revalidatePath('/admin/governance');
  return { success: true, id: data.id };
}

export async function decideApprovalRequest(
  id: string,
  status: string,
  notes?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('approval_workflows.manage');
  } catch {
    return { success: false, message: 'You do not have permission to decide approval requests.' };
  }

  if (!VALID_STATUSES.has(status) || status === 'pending') {
    return { success: false, message: 'Invalid decision.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('approval_requests')
    .update({
      status,
      decision_notes: notes?.trim() || null,
      decided_by: user.email,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to decide approval request', id, error);
    return { success: false, message: 'Failed to record decision.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `decision_${status}`,
    module: 'approval_requests',
    recordId: id,
    newValue: { status, notes },
  });

  revalidatePath('/admin/governance/approval-workflows');
  revalidatePath('/admin/governance');
  return { success: true };
}
