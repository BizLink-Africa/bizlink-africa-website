'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { CONTENT_TYPES, type ApprovalStatus, type ContentStatus, type ContentType } from '@/data/marketing';

const MAX_TEXT_LENGTH = 200;
const VALID_CONTENT_TYPES = new Set<string>(CONTENT_TYPES.map((t) => t.value));

export interface ContentCalendarInput {
  title: string;
  channel?: string;
  campaignId?: string;
  contentType: ContentType;
  plannedDate?: string;
  ownerUserId?: string;
}

export async function createContentCalendarItem(input: ContentCalendarInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('content_calendar.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the content calendar.' };
  }

  if (!input.title?.trim()) {
    return { success: false, message: 'Title is required.' };
  }
  if (!VALID_CONTENT_TYPES.has(input.contentType)) {
    return { success: false, message: 'Invalid content type.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_calendar_items')
    .insert({
      title: input.title.trim().slice(0, MAX_TEXT_LENGTH),
      channel: input.channel || null,
      campaign_id: input.campaignId || null,
      content_type: input.contentType,
      planned_date: input.plannedDate || null,
      owner_user_id: input.ownerUserId || null,
      status: 'planned',
      approval_status: 'pending',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create content calendar item', error);
    return { success: false, message: 'Failed to create content calendar item.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'content_calendar_items',
    recordId: data.id,
    newValue: { title: input.title },
  });

  revalidatePath('/admin/marketing/content-calendar');
  return { success: true, id: data.id };
}

export async function updateContentCalendarStatus(id: string, status: ContentStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('content_calendar.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the content calendar.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('content_calendar_items').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update content status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'status_change', module: 'content_calendar_items', recordId: id, newValue: { status } });
  revalidatePath('/admin/marketing/content-calendar');
  return { success: true };
}

export async function updateContentApprovalStatus(id: string, approvalStatus: ApprovalStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('content_calendar.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the content calendar.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('content_calendar_items').update({ approval_status: approvalStatus }).eq('id', id);

  if (error) {
    console.error('Failed to update content approval status', id, error);
    return { success: false, message: 'Failed to update approval status.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'approval_status_change', module: 'content_calendar_items', recordId: id, newValue: { approvalStatus } });
  revalidatePath('/admin/marketing/content-calendar');
  return { success: true };
}

export async function updateContentPublishedLink(id: string, publishedLink: string, performanceNotes: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('content_calendar.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the content calendar.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('content_calendar_items')
    .update({ published_link: publishedLink.trim() || null, performance_notes: performanceNotes.trim() || null })
    .eq('id', id);

  if (error) {
    console.error('Failed to update content published link', id, error);
    return { success: false, message: 'Failed to save.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'update_performance', module: 'content_calendar_items', recordId: id, newValue: { publishedLink } });
  revalidatePath('/admin/marketing/content-calendar');
  return { success: true };
}
