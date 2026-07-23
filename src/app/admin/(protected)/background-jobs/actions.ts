'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { JOB_STATUSES } from '@/data/backgroundJobs';

const VALID_STATUSES = new Set<string>(JOB_STATUSES.map((s) => s.value));

export interface BackgroundJobInput {
  jobName: string;
  queue?: string;
  status: string;
  failureReason?: string;
}

export async function createBackgroundJob(input: BackgroundJobInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('jobs.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record background jobs.' };
  }

  if (!input.jobName?.trim()) {
    return { success: false, message: 'Job name is required.' };
  }
  if (!VALID_STATUSES.has(input.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('background_jobs')
    .insert({
      job_name: input.jobName.trim(),
      queue: input.queue?.trim() || 'default',
      status: input.status,
      started_at: input.status === 'running' || input.status === 'completed' || input.status === 'failed' ? now : null,
      completed_at: input.status === 'completed' ? now : null,
      failure_reason: input.failureReason?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create background job record', error);
    return { success: false, message: 'Failed to record background job.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'background_jobs',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/background-jobs');
  revalidatePath('/admin/cto');
  return { success: true };
}

// Retrying a failed job is a distinct workflow step (not a free-form status
// edit): it requeues the job and increments its retry count atomically, so
// the retry count always reflects exactly how many times it's been retried.
export async function retryBackgroundJob(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('jobs.manage');
  } catch {
    return { success: false, message: 'You do not have permission to retry background jobs.' };
  }

  const supabase = await createClient();
  const { data: job, error: fetchError } = await supabase.from('background_jobs').select('retries').eq('id', id).single();

  if (fetchError || !job) {
    return { success: false, message: 'Job not found.' };
  }

  const { error } = await supabase
    .from('background_jobs')
    .update({ status: 'retrying', retries: job.retries + 1, completed_at: null, failure_reason: null })
    .eq('id', id);

  if (error) {
    console.error('Failed to retry background job', id, error);
    return { success: false, message: 'Failed to retry job.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'retry',
    module: 'background_jobs',
    recordId: id,
  });

  revalidatePath('/admin/background-jobs');
  revalidatePath('/admin/cto');
  return { success: true };
}
