'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { FollowUpStatus } from '@/data/crm';

export interface FollowUpInput {
  followUpDate: string;
  leadId?: string;
  clientId?: string;
  assignedUserId?: string;
  communicationType: string;
  purpose?: string;
}

export async function createFollowUp(input: FollowUpInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('crm.followups.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create follow-ups.' };
  }

  if (!input.followUpDate) {
    return { success: false, message: 'Follow-up date is required.' };
  }
  if (!input.clientId && !input.leadId) {
    return { success: false, message: 'A follow-up must be linked to a client or a lead.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('crm_follow_ups')
    .insert({
      follow_up_date: input.followUpDate,
      lead_id: input.leadId || null,
      client_id: input.clientId || null,
      assigned_user_id: input.assignedUserId || null,
      communication_type: input.communicationType,
      purpose: input.purpose?.trim() || null,
      status: 'scheduled',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create follow-up', error);
    return { success: false, message: 'Failed to create follow-up.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'crm_follow_ups',
    recordId: data.id,
    newValue: { followUpDate: input.followUpDate },
  });

  revalidatePath('/admin/crm/follow-ups');
  revalidatePath('/admin/crm/pipeline');
  return { success: true, id: data.id };
}

export async function completeFollowUp(
  id: string,
  status: FollowUpStatus,
  result?: string,
  nextAction?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('crm.followups.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update follow-ups.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('crm_follow_ups')
    .update({
      status,
      result: result?.trim() || null,
      next_action: nextAction?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update follow-up', id, error);
    return { success: false, message: 'Failed to update follow-up.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'crm_follow_ups',
    recordId: id,
    newValue: { status, result: result?.trim() || null, nextAction: nextAction?.trim() || null },
  });

  revalidatePath('/admin/crm/follow-ups');
  revalidatePath('/admin/crm/pipeline');
  return { success: true };
}
