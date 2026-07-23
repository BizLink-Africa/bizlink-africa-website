'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { HEALTH_STATUSES } from '@/data/systemHealth';

const VALID_STATUSES = new Set<string>(HEALTH_STATUSES.map((s) => s.value));

export async function updateSystemHealthCheck(
  id: string,
  input: { status: string; detail?: string; errorRatePercentage?: number }
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('system.health.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update system health.' };
  }

  if (!VALID_STATUSES.has(input.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('system_health_checks')
    .update({
      status: input.status,
      detail: input.detail?.trim() || null,
      error_rate_percentage: input.errorRatePercentage ?? null,
      checked_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update system health check', id, error);
    return { success: false, message: 'Failed to update system health check.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'system_health_checks',
    recordId: id,
    newValue: input,
  });

  revalidatePath('/admin/system-health');
  revalidatePath('/admin/cto');
  return { success: true };
}
