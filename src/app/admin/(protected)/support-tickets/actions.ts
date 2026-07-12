'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { TICKET_CATEGORIES, TICKET_STATUSES } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';

const VALID_CATEGORIES = new Set<string>(TICKET_CATEGORIES.map((c) => c.value));
const VALID_STATUSES = new Set<string>(TICKET_STATUSES.map((s) => s.value));
const VALID_PRIORITIES = new Set<string>(PRIORITY_LEVELS.map((p) => p.value));
const MAX_TITLE_LENGTH = 200;

export interface TicketInput {
  title: string;
  clientId?: string;
  category: string;
  priority: string;
  assignedStaff?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createTicket(input: TicketInput): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!isNonEmptyString(input.title)) {
    return { success: false, message: 'Ticket title is required.' };
  }
  if (!VALID_CATEGORIES.has(input.category)) {
    return { success: false, message: 'Invalid category.' };
  }
  if (!VALID_PRIORITIES.has(input.priority)) {
    return { success: false, message: 'Invalid priority.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
      client_id: input.clientId || null,
      category: input.category,
      priority: input.priority,
      assigned_staff: input.assignedStaff?.trim() || null,
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
    newValue: input,
  });

  revalidatePath('/admin/support-tickets');
  return { success: true };
}

export async function updateTicketStatus(id: string, status: string): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update ticket status', id, error);
    return { success: false, message: 'Failed to update ticket.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'support_tickets',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/support-tickets');
  return { success: true };
}
