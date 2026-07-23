'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { sendEmail } from '@/lib/email/resend';
import { buildExecutiveDecisionEmail } from '@/lib/email/templates';

const MAX_TEXT_LENGTH = 500;

// Never lets a notification failure block the decision itself — mirrors
// logAuditEvent's own never-throw contract. Soft-fails (no recipient
// configured, or Resend not configured) rather than erroring.
async function notifyDecision(itemTitle: string, actionType: string, decidedBy: string, comment: string | null, href: string) {
  const recipient = process.env.BIZLINK_NOTIFICATION_EMAIL;
  if (!recipient) return;
  const email = buildExecutiveDecisionEmail({ itemTitle, actionType, decidedBy, comment, href });
  await sendEmail({ to: recipient, subject: email.subject, html: email.html, text: email.text });
}

export async function addExecutiveComment(
  sourceModule: string,
  sourceId: string,
  itemTitle: string,
  href: string,
  comment: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('executive.actions.manage');
  } catch {
    return { success: false, message: 'You do not have permission to comment on executive items.' };
  }

  const trimmed = comment.trim();
  if (!trimmed) return { success: false, message: 'Comment cannot be empty.' };

  // Logs only { comment } — never the full source record — matching the
  // established precedent in contracts/actions.ts of withholding sensitive
  // field values from audit_logs by design.
  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'comment',
    module: sourceModule,
    recordId: sourceId,
    newValue: { comment: trimmed.slice(0, MAX_TEXT_LENGTH) },
  });

  await notifyDecision(itemTitle, 'Comment added', user.email ?? 'unknown', trimmed, href);

  revalidatePath('/admin/ceo/actions');
  revalidatePath('/admin/ceo/approvals');
  revalidatePath('/admin/ceo/alerts');
  return { success: true };
}

export interface FollowUpInput {
  sourceModule: string;
  sourceId: string;
  itemTitle: string;
  href: string;
  actionType: 'assign' | 'escalate';
  assignedTo: string;
  priority?: string;
  deadline?: string;
  note?: string;
}

// Backs both "Assign Follow-up" and "Escalate" — same data shape
// (assignee/priority/deadline/note), differing only in action_type and
// label. Kept as one function rather than two near-duplicates.
export async function assignFollowUp(input: FollowUpInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('executive.actions.manage');
  } catch {
    return { success: false, message: 'You do not have permission to assign follow-ups.' };
  }

  if (!input.assignedTo.trim()) {
    return { success: false, message: 'Assignee is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('executive_follow_ups')
    .insert({
      source_module: input.sourceModule,
      source_id: input.sourceId,
      action_type: input.actionType,
      assigned_to: input.assignedTo.trim().slice(0, 200),
      priority: input.priority ?? 'normal',
      deadline: input.deadline || null,
      note: input.note?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create follow-up', error);
    return { success: false, message: 'Failed to save follow-up.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: input.actionType === 'escalate' ? 'escalate' : 'assign_follow_up',
    module: input.sourceModule,
    recordId: input.sourceId,
    newValue: { assignedTo: input.assignedTo.trim(), priority: input.priority ?? 'normal', deadline: input.deadline || null },
  });

  await notifyDecision(
    input.itemTitle,
    input.actionType === 'escalate' ? 'Escalated' : 'Assigned for follow-up',
    user.email ?? 'unknown',
    input.note ?? null,
    input.href
  );

  revalidatePath('/admin/ceo/actions');
  revalidatePath('/admin/ceo/approvals');
  revalidatePath('/admin/ceo/alerts');
  return { success: true };
}

export async function completeFollowUp(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('executive.actions.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update follow-ups.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('executive_follow_ups').update({ status: 'done' }).eq('id', id);
  if (error) {
    console.error('Failed to complete follow-up', id, error);
    return { success: false, message: 'Failed to update follow-up.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'complete_follow_up',
    module: 'executive_follow_ups',
    recordId: id,
  });

  revalidatePath('/admin/ceo/actions');
  revalidatePath('/admin/ceo/approvals');
  return { success: true };
}
