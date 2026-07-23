'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 2000;

export interface CsatInput {
  ticketId: string;
  clientId?: string;
  agentUserId?: string;
  rating: number;
  feedback?: string;
}

export async function recordCsat(input: CsatInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('csat.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record customer satisfaction.' };
  }

  if (!input.ticketId) {
    return { success: false, message: 'A ticket is required.' };
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { success: false, message: 'Rating must be a whole number from 1 to 5.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('support_ticket_satisfaction')
    .insert({
      ticket_id: input.ticketId,
      client_id: input.clientId || null,
      agent_user_id: input.agentUserId || null,
      rating: input.rating,
      feedback: input.feedback?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to record CSAT', error);
    return { success: false, message: 'Failed to save (a rating may already exist for this ticket).' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'create', module: 'support_ticket_satisfaction', recordId: data.id, newValue: { rating: input.rating } });
  revalidatePath('/admin/support/satisfaction');
  revalidatePath('/admin/support');
  return { success: true, id: data.id };
}
