'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { BACKUP_TYPES, BACKUP_STATUSES } from '@/data/backups';

const VALID_TYPES = new Set<string>(BACKUP_TYPES.map((t) => t.value));
const VALID_STATUSES = new Set<string>(BACKUP_STATUSES.map((s) => s.value));

export interface BackupRecordInput {
  system: string;
  backupType: string;
  status: string;
  sizeMb?: number;
  location?: string;
  nextScheduledAt?: string;
}

export async function createBackupRecord(input: BackupRecordInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('backups.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record backups.' };
  }

  if (!input.system?.trim()) {
    return { success: false, message: 'System is required.' };
  }
  if (!VALID_TYPES.has(input.backupType)) {
    return { success: false, message: 'Invalid backup type.' };
  }
  if (!VALID_STATUSES.has(input.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('backup_records')
    .insert({
      system: input.system.trim(),
      backup_type: input.backupType,
      status: input.status,
      started_at: now,
      completed_at: input.status === 'completed' ? now : null,
      size_mb: input.sizeMb ?? null,
      location: input.location?.trim() || null,
      next_scheduled_at: input.nextScheduledAt || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to record backup', error);
    return { success: false, message: 'Failed to record backup.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'backup_records',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/backup-monitoring');
  revalidatePath('/admin/cto');
  return { success: true };
}

export async function updateBackupStatus(id: string, status: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('backups.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update backup status.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('backup_records')
    .update({
      status,
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update backup status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'backup_records',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/backup-monitoring');
  revalidatePath('/admin/cto');
  return { success: true };
}
