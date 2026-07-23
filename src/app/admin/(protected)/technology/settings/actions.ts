'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export interface TechnologySettingsInput {
  uptimeTargetPercentage: number;
  apiResponseTimeTargetMs: number;
  incidentAlertEmail: string;
  maintenanceMode: boolean;
  monitoringIntervalMinutes: number;
  logsRetentionDays: number;
  backupsRetentionDays: number;
}

export async function updateTechnologySettings(input: TechnologySettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('technology.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change technology settings.' };
  }

  if (input.uptimeTargetPercentage < 0 || input.uptimeTargetPercentage > 100) {
    return { success: false, message: 'Uptime target must be between 0 and 100.' };
  }
  if (input.apiResponseTimeTargetMs < 0) {
    return { success: false, message: 'API response time target cannot be negative.' };
  }
  if (input.monitoringIntervalMinutes <= 0 || input.logsRetentionDays <= 0 || input.backupsRetentionDays <= 0) {
    return { success: false, message: 'Monitoring interval and retention periods must be greater than zero.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      uptime_target_percentage: input.uptimeTargetPercentage,
      api_response_time_target_ms: input.apiResponseTimeTargetMs,
      incident_alert_email: input.incidentAlertEmail.trim() || null,
      maintenance_mode: input.maintenanceMode,
      technology_monitoring_interval_minutes: input.monitoringIntervalMinutes,
      technology_logs_retention_days: input.logsRetentionDays,
      technology_backups_retention_days: input.backupsRetentionDays,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update technology settings', error);
    return { success: false, message: 'Failed to save technology settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/technology/settings');
  return { success: true };
}

export async function setDeploymentEnvironmentActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('technology.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change technology settings.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('technology_deployment_environments').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update deployment environment', id, error);
    return { success: false, message: 'Failed to save deployment environment.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isActive ? 'activate' : 'deactivate',
    module: 'technology_deployment_environments',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/technology/settings');
  return { success: true };
}

// Single-argument, string-in wrapper so InlineSelect (a Client Component)
// can bind it directly — onSave={setDeploymentEnvironmentActiveOption.bind(null, env.id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component. InlineSelect
// always calls onSave with the raw option value ('true'/'false'), so the
// boolean conversion has to happen in here rather than at the call site.
export async function setDeploymentEnvironmentActiveOption(id: string, value: string): Promise<{ success: boolean; message?: string }> {
  return setDeploymentEnvironmentActive(id, value === 'true');
}
