'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { DEPARTMENT_NAMES } from '@/data/departments';

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export interface NotificationInput {
  title: string;
  message: string;
  priority: string;
  department: string;
  relatedModule?: string;
  relatedRecordId?: string;
}

async function currentStaffId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('staff_profiles').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function createNotification(input: NotificationInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('notifications.manage');
  } catch {
    return { success: false, message: 'You do not have permission to broadcast notifications.' };
  }

  if (!input.title.trim() || !input.message.trim()) {
    return { success: false, message: 'Title and message are required.' };
  }
  if (!PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number])) {
    return { success: false, message: 'Invalid priority.' };
  }
  if (input.department && !DEPARTMENT_NAMES.includes(input.department as (typeof DEPARTMENT_NAMES)[number])) {
    return { success: false, message: 'Invalid department.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('admin_notifications')
    .insert({
      title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
      message: input.message.trim().slice(0, MAX_MESSAGE_LENGTH),
      priority: input.priority,
      department: input.department || null,
      related_module: input.relatedModule?.trim() || null,
      related_record_id: input.relatedRecordId?.trim() || null,
      created_by: user.email ?? 'unknown',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create notification', error);
    return { success: false, message: 'Failed to send notification.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'broadcast',
    module: 'admin_notifications',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/notifications');
  return { success: true, message: 'Notification sent.' };
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('notifications.view');
  } catch {
    return { success: false, message: 'You do not have permission to view notifications.' };
  }

  const staffId = await currentStaffId(user.id);
  if (!staffId) return { success: false, message: 'No active staff profile linked to this account.' };

  const supabase = await createClient();
  // ignoreDuplicates -> INSERT ... ON CONFLICT DO NOTHING: the reads table
  // only has an insert policy (read receipts are append-only, never
  // edited), so a real upsert (which would UPDATE on conflict) would fail.
  const { error } = await supabase
    .from('admin_notification_reads')
    .upsert({ notification_id: notificationId, staff_id: staffId }, { onConflict: 'notification_id,staff_id', ignoreDuplicates: true });

  if (error) {
    console.error('Failed to mark notification read', notificationId, error);
    return { success: false, message: 'Failed to mark as read.' };
  }

  revalidatePath('/admin/notifications');
  return { success: true };
}

export async function markAllNotificationsRead(notificationIds: string[]): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();
  try {
    await requirePermission('notifications.view');
  } catch {
    return { success: false, message: 'You do not have permission to view notifications.' };
  }

  const staffId = await currentStaffId(user.id);
  if (!staffId) return { success: false, message: 'No active staff profile linked to this account.' };
  if (notificationIds.length === 0) return { success: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from('admin_notification_reads')
    .upsert(
      notificationIds.map((id) => ({ notification_id: id, staff_id: staffId })),
      { onConflict: 'notification_id,staff_id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('Failed to mark all notifications read', error);
    return { success: false, message: 'Failed to mark all as read.' };
  }

  revalidatePath('/admin/notifications');
  return { success: true };
}
