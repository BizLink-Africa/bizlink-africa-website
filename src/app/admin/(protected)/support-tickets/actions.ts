'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { TICKET_CATEGORIES, TICKET_STATUSES, ESCALATION_TARGETS, DEPARTMENTS, type TicketStatus, type EscalationTarget, type Department } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';

const VALID_CATEGORIES = new Set<string>(TICKET_CATEGORIES.map((c) => c.value));
const VALID_STATUSES = new Set<string>(TICKET_STATUSES.map((s) => s.value));
const VALID_PRIORITIES = new Set<string>(PRIORITY_LEVELS.map((p) => p.value));
const VALID_ESCALATION_TARGETS = new Set<string>(ESCALATION_TARGETS.map((t) => t.value));
const VALID_DEPARTMENTS = new Set<string>(DEPARTMENTS.map((d) => d.value));
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;

// Statuses reachable through the generic updateTicketStatus below —
// 'resolved' requires tickets.resolve (checked separately) and 'escalated'
// only ever gets set atomically with a target+reason by escalateTicket, so
// neither is a valid target here.
const SIMPLE_STATUS_TARGETS = new Set<TicketStatus>([
  'new', 'open', 'in_progress', 'waiting_client', 'waiting_internal', 'closed', 'reopened',
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface TicketInput {
  title: string;
  description?: string;
  clientId?: string;
  contactPerson?: string;
  contactEmail?: string;
  category: string;
  priority: string;
  department?: Department;
  assignedUserId?: string;
  relatedServiceId?: string;
  relatedIntegrationId?: string;
  relatedAiAgentId?: string;
}

export async function createTicket(input: TicketInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('tickets.create');
  } catch {
    return { success: false, message: 'You do not have permission to create tickets.' };
  }

  if (!isNonEmptyString(input.title)) {
    return { success: false, message: 'Ticket title is required.' };
  }
  if (!VALID_CATEGORIES.has(input.category)) {
    return { success: false, message: 'Invalid category.' };
  }
  if (!VALID_PRIORITIES.has(input.priority)) {
    return { success: false, message: 'Invalid priority.' };
  }
  if (input.department && !VALID_DEPARTMENTS.has(input.department)) {
    return { success: false, message: 'Invalid department.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'TCK' });
  if (numberError || !numberData) {
    console.error('Failed to generate ticket number', numberError);
    return { success: false, message: 'Failed to generate a ticket number.' };
  }

  const { data: slaRule } = await supabase.from('support_sla_rules').select('response_hours, resolution_hours').eq('priority', input.priority).maybeSingle();
  const now = Date.now();
  const responseDeadline = slaRule ? new Date(now + slaRule.response_hours * 60 * 60 * 1000).toISOString() : null;
  const resolutionDeadline = slaRule ? new Date(now + slaRule.resolution_hours * 60 * 60 * 1000).toISOString() : null;

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      ticket_number: numberData,
      title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
      description: input.description?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      client_id: input.clientId || null,
      contact_person: input.contactPerson?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      category: input.category,
      priority: input.priority,
      department: input.department || null,
      assigned_user_id: input.assignedUserId || null,
      related_service_id: input.relatedServiceId || null,
      related_integration_id: input.relatedIntegrationId || null,
      related_ai_agent_id: input.relatedAiAgentId || null,
      response_deadline: responseDeadline,
      resolution_deadline: resolutionDeadline,
      status: 'new',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create ticket', error);
    return { success: false, message: 'Failed to create ticket.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'support_tickets',
    recordId: data.id,
    newValue: { ticketNumber: numberData, category: input.category, priority: input.priority },
  });

  revalidatePath('/admin/support-tickets');
  revalidatePath('/admin/support');
  return { success: true, id: data.id };
}

export async function updateTicketStatus(id: string, status: string): Promise<{ success: boolean; message?: string }> {
  if (!VALID_STATUSES.has(status) || !SIMPLE_STATUS_TARGETS.has(status as TicketStatus)) {
    return { success: false, message: 'Invalid status.' };
  }

  let user;
  try {
    user = await requirePermission('tickets.update');
  } catch {
    return { success: false, message: 'You do not have permission to update tickets.' };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };

  if (status === 'reopened') {
    const { data: existing } = await supabase.from('support_tickets').select('reopened_count').eq('id', id).single();
    updates.reopened_count = (existing?.reopened_count ?? 0) + 1;
    updates.resolved_at = null;
  }

  const { error } = await supabase.from('support_tickets').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update ticket status', id, error);
    return { success: false, message: 'Failed to update ticket.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'support_tickets',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/support-tickets');
  revalidatePath(`/admin/support-tickets/${id}`);
  revalidatePath('/admin/support');
  return { success: true };
}

export async function resolveTicket(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('tickets.resolve');
  } catch {
    return { success: false, message: 'You do not have permission to resolve tickets.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('support_tickets').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);

  if (error) {
    console.error('Failed to resolve ticket', id, error);
    return { success: false, message: 'Failed to resolve ticket.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'status_resolved', module: 'support_tickets', recordId: id, newValue: { status: 'resolved' } });
  revalidatePath('/admin/support-tickets');
  revalidatePath(`/admin/support-tickets/${id}`);
  revalidatePath('/admin/support');
  return { success: true };
}

export interface TicketDetailsInput {
  description?: string;
  contactPerson?: string;
  contactEmail?: string;
  department?: Department;
  relatedServiceId?: string;
  relatedIntegrationId?: string;
  relatedAiAgentId?: string;
}

export async function updateTicketDetails(id: string, input: TicketDetailsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('tickets.update');
  } catch {
    return { success: false, message: 'You do not have permission to update tickets.' };
  }

  if (input.department && !VALID_DEPARTMENTS.has(input.department)) {
    return { success: false, message: 'Invalid department.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('support_tickets')
    .update({
      description: input.description?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      contact_person: input.contactPerson?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      department: input.department || null,
      related_service_id: input.relatedServiceId || null,
      related_integration_id: input.relatedIntegrationId || null,
      related_ai_agent_id: input.relatedAiAgentId || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update ticket details', id, error);
    return { success: false, message: 'Failed to update ticket.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'update_details', module: 'support_tickets', recordId: id, newValue: {} });
  revalidatePath(`/admin/support-tickets/${id}`);
  return { success: true };
}

export async function assignTicket(id: string, assignedUserId: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('tickets.assign');
  } catch {
    return { success: false, message: 'You do not have permission to assign tickets.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('support_tickets').update({ assigned_user_id: assignedUserId || null }).eq('id', id);

  if (error) {
    console.error('Failed to assign ticket', id, error);
    return { success: false, message: 'Failed to assign ticket.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'assign', module: 'support_tickets', recordId: id, newValue: { assignedUserId } });
  revalidatePath('/admin/support-tickets');
  revalidatePath(`/admin/support-tickets/${id}`);
  return { success: true };
}

export interface EscalateTicketInput {
  target: EscalationTarget;
  reason: string;
}

export async function escalateTicket(id: string, input: EscalateTicketInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('tickets.escalate');
  } catch {
    return { success: false, message: 'You do not have permission to escalate tickets.' };
  }

  if (!VALID_ESCALATION_TARGETS.has(input.target)) {
    return { success: false, message: 'Invalid escalation target.' };
  }
  if (!isNonEmptyString(input.reason)) {
    return { success: false, message: 'An escalation reason is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'escalated',
      escalated_to: input.target,
      escalation_reason: input.reason.trim().slice(0, MAX_TEXT_LENGTH),
      escalated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to escalate ticket', id, error);
    return { success: false, message: 'Failed to escalate ticket.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'escalate',
    module: 'support_tickets',
    recordId: id,
    newValue: { target: input.target, reason: input.reason },
  });

  revalidatePath('/admin/support-tickets');
  revalidatePath(`/admin/support-tickets/${id}`);
  revalidatePath('/admin/support-tickets/escalations');
  revalidatePath('/admin/support');
  return { success: true };
}

export interface AddMessageInput {
  message: string;
  isInternal: boolean;
}

// The only write path for ticket messages — is_internal is set here, from
// a real permission-checked server action, never trusted from a client
// value alone. Posting the first client-visible reply stamps
// first_response_at (feeding the Average First-Response Time KPI); it is
// never set by an internal note.
export async function addTicketMessage(ticketId: string, input: AddMessageInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('tickets.update');
  } catch {
    return { success: false, message: 'You do not have permission to reply to tickets.' };
  }

  if (!isNonEmptyString(input.message)) {
    return { success: false, message: 'Message cannot be empty.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticketId,
      author: user.email ?? 'unknown',
      message: input.message.trim().slice(0, MAX_TEXT_LENGTH),
      is_internal: input.isInternal,
      staff_user_id: null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to add ticket message', ticketId, error);
    return { success: false, message: 'Failed to add message.' };
  }

  if (!input.isInternal) {
    const { data: ticket } = await supabase.from('support_tickets').select('first_response_at').eq('id', ticketId).single();
    if (ticket && !ticket.first_response_at) {
      await supabase.from('support_tickets').update({ first_response_at: new Date().toISOString() }).eq('id', ticketId);
    }
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: input.isInternal ? 'add_internal_note' : 'add_client_reply',
    module: 'support_tickets',
    recordId: ticketId,
    newValue: { isInternal: input.isInternal },
  });

  revalidatePath(`/admin/support-tickets/${ticketId}`);
  revalidatePath('/admin/support/conversations');
  return { success: true, id: data.id };
}

export async function uploadTicketAttachment(messageId: string, formData: FormData): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('tickets.update');
  } catch {
    return { success: false, message: 'You do not have permission to upload attachments.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: 'Please select a file.' };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { success: false, message: 'File is too large (max 20MB).' };
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath = `${messageId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from('support-attachments').upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('Failed to upload ticket attachment', messageId, uploadError);
    return { success: false, message: 'Failed to upload attachment.' };
  }

  const { error: insertError } = await supabase.from('support_ticket_attachments').insert({
    message_id: messageId,
    file_path: storagePath,
    file_name: file.name.slice(0, MAX_TITLE_LENGTH),
    uploaded_by: user.email,
  });

  if (insertError) {
    console.error('Failed to record ticket attachment', messageId, insertError);
    return { success: false, message: 'File uploaded, but failed to record it.' };
  }

  return { success: true };
}

export async function getTicketAttachmentUrl(filePath: string): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    await requirePermission('tickets.view');
  } catch {
    return { success: false, message: 'You do not have permission to view attachments.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('support-attachments').createSignedUrl(filePath, 60);

  if (error || !data) {
    return { success: false, message: 'Failed to generate a download link.' };
  }

  return { success: true, url: data.signedUrl };
}
