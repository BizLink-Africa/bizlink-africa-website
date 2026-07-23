'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const VALID_STATUSES = new Set(['operational', 'degraded', 'down']);

export interface DatabaseHealthMetricInput {
  metricName: string;
  value?: number;
  unit?: string;
  status: string;
}

export async function createDatabaseHealthMetric(input: DatabaseHealthMetricInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('database.health.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record database health metrics.' };
  }

  if (!input.metricName?.trim()) {
    return { success: false, message: 'Metric name is required.' };
  }
  if (!VALID_STATUSES.has(input.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('database_health_metrics')
    .insert({
      metric_name: input.metricName.trim(),
      value: input.value ?? null,
      unit: input.unit?.trim() || null,
      status: input.status,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to record database health metric', error);
    return { success: false, message: 'Failed to record metric.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'database_health_metrics',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/database-health');
  revalidatePath('/admin/cto');
  return { success: true };
}
