'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { DEPLOYMENT_ENVIRONMENTS, DEPLOYMENT_STATUSES } from '@/data/deployments';

const VALID_ENVIRONMENTS = new Set<string>(DEPLOYMENT_ENVIRONMENTS.map((e) => e.value));
const VALID_STATUSES = new Set<string>(DEPLOYMENT_STATUSES.map((s) => s.value));

export interface DeploymentInput {
  application: string;
  environment: string;
  version: string;
  status: string;
  startedBy?: string;
  result?: string;
}

export async function createDeployment(input: DeploymentInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('deployments.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record deployments.' };
  }

  if (!input.application?.trim() || !input.version?.trim()) {
    return { success: false, message: 'Application and version are required.' };
  }
  if (!VALID_ENVIRONMENTS.has(input.environment)) {
    return { success: false, message: 'Invalid environment.' };
  }
  if (!VALID_STATUSES.has(input.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('deployments')
    .insert({
      application: input.application.trim(),
      environment: input.environment,
      version: input.version.trim(),
      status: input.status,
      started_by: input.startedBy?.trim() || user.email,
      start_time: now,
      end_time: input.status === 'success' || input.status === 'failed' ? now : null,
      result: input.result?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create deployment record', error);
    return { success: false, message: 'Failed to record deployment.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'deployments',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/deployments');
  revalidatePath('/admin/cto');
  return { success: true };
}

export async function updateDeploymentStatus(id: string, status: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('deployments.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update deployment status.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('deployments')
    .update({
      status,
      ...(status === 'success' || status === 'failed' ? { end_time: new Date().toISOString() } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update deployment status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'deployments',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/deployments');
  revalidatePath('/admin/cto');
  return { success: true };
}

// Rolling back is a distinct workflow step from just changing status — it
// marks the deployment rolled_back AND starts the rollback_status lifecycle,
// so the two states can't silently drift out of sync with each other.
export async function rollbackDeployment(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('deployments.manage');
  } catch {
    return { success: false, message: 'You do not have permission to roll back deployments.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('deployments')
    .update({ status: 'rolled_back', rollback_status: 'in_progress' })
    .eq('id', id);

  if (error) {
    console.error('Failed to roll back deployment', id, error);
    return { success: false, message: 'Failed to roll back deployment.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'rollback',
    module: 'deployments',
    recordId: id,
  });

  revalidatePath('/admin/deployments');
  revalidatePath('/admin/cto');
  return { success: true };
}
