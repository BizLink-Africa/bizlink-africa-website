'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export interface NotificationSettingsInput {
  broadcastEnabled: boolean;
  defaultPriority: string;
}

export async function updateNotificationSettings(input: NotificationSettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('notification.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change notification settings.' };
  }

  if (!PRIORITIES.includes(input.defaultPriority as (typeof PRIORITIES)[number])) {
    return { success: false, message: 'Invalid default priority.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      notifications_broadcast_enabled: input.broadcastEnabled,
      notifications_default_priority: input.defaultPriority,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update notification settings', error);
    return { success: false, message: 'Failed to save notification settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings/notification-settings');
  return { success: true };
}
