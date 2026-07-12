'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { API_STATUSES } from '@/data/integrations';

const VALID_STATUSES = new Set<string>(API_STATUSES.map((s) => s.value));

export interface IntegrationInput {
  clientId?: string;
  serviceType: string;
  apiStatus: string;
  webhookEndpoint?: string;
  errorMessage?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createIntegrationRecord(
  input: IntegrationInput
): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!isNonEmptyString(input.serviceType)) {
    return { success: false, message: 'Service type is required.' };
  }
  if (!VALID_STATUSES.has(input.apiStatus)) {
    return { success: false, message: 'Invalid API status.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('integration_health')
    .insert({
      client_id: input.clientId || null,
      service_type: input.serviceType,
      api_status: input.apiStatus,
      webhook_endpoint: input.webhookEndpoint?.trim() || null,
      error_message: input.errorMessage?.trim() || null,
      last_failed_request: input.apiStatus === 'failed' ? new Date().toISOString() : null,
      last_successful_request: input.apiStatus === 'active' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create integration record', error);
    return { success: false, message: 'Failed to create integration record.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'integration_health',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/integration-health');
  return { success: true };
}

export async function updateIntegrationStatus(
  id: string,
  apiStatus: string
): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!VALID_STATUSES.has(apiStatus)) {
    return { success: false, message: 'Invalid API status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('integration_health')
    .update({
      api_status: apiStatus,
      ...(apiStatus === 'active' ? { last_successful_request: new Date().toISOString() } : {}),
      ...(apiStatus === 'failed' ? { last_failed_request: new Date().toISOString() } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update integration status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'integration_health',
    recordId: id,
    newValue: { apiStatus },
  });

  revalidatePath('/admin/integration-health');
  return { success: true };
}
