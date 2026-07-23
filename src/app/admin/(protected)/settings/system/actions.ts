'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

export interface SystemSettingsInput {
  timezone: string;
  language: string;
  fileStorageNotes: string;
}

export async function updateSystemSettings(input: SystemSettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('system.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change system settings.' };
  }

  if (!input.timezone.trim() || !input.language.trim()) {
    return { success: false, message: 'Timezone and language are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      system_timezone: input.timezone.trim().slice(0, MAX_TEXT_LENGTH),
      system_language: input.language.trim().slice(0, 10),
      system_file_storage_notes: input.fileStorageNotes.trim().slice(0, MAX_NOTES_LENGTH) || null,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update system settings', error);
    return { success: false, message: 'Failed to save system settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings/system');
  return { success: true };
}
