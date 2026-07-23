'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { API_STATUSES, INTEGRATION_TYPES, ENVIRONMENTS, WEBHOOK_STATUSES, INCIDENT_STATUSES } from '@/data/integrations';

const VALID_STATUSES = new Set<string>(API_STATUSES.map((s) => s.value));
const VALID_TYPES = new Set<string>(INTEGRATION_TYPES.map((t) => t.value));
const VALID_ENVIRONMENTS = new Set<string>(ENVIRONMENTS.map((e) => e.value));
const VALID_WEBHOOK_STATUSES = new Set<string>(WEBHOOK_STATUSES.map((s) => s.value));
const VALID_INCIDENT_STATUSES = new Set<string>(INCIDENT_STATUSES.map((s) => s.value));

export interface IntegrationInput {
  clientId?: string;
  serviceType: string;
  integrationType?: string;
  environment?: string;
  apiStatus: string;
  webhookEndpoint?: string;
  webhookStatus?: string;
  errorMessage?: string;
  technicalOwner?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createIntegrationRecord(
  input: IntegrationInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('integrations.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create integration records.' };
  }

  if (!isNonEmptyString(input.serviceType)) {
    return { success: false, message: 'Service type is required.' };
  }
  if (!VALID_STATUSES.has(input.apiStatus)) {
    return { success: false, message: 'Invalid API status.' };
  }
  if (input.integrationType && !VALID_TYPES.has(input.integrationType)) {
    return { success: false, message: 'Invalid integration type.' };
  }
  if (input.environment && !VALID_ENVIRONMENTS.has(input.environment)) {
    return { success: false, message: 'Invalid environment.' };
  }
  if (input.webhookStatus && !VALID_WEBHOOK_STATUSES.has(input.webhookStatus)) {
    return { success: false, message: 'Invalid webhook status.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('integration_health')
    .insert({
      client_id: input.clientId || null,
      service_type: input.serviceType,
      integration_type: input.integrationType || null,
      environment: input.environment || 'production',
      api_status: input.apiStatus,
      webhook_endpoint: input.webhookEndpoint?.trim() || null,
      webhook_status: input.webhookStatus || 'not_configured',
      error_message: input.errorMessage?.trim() || null,
      technical_owner: input.technicalOwner?.trim() || null,
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
  revalidatePath('/admin/cto');
  return { success: true };
}

export async function updateIntegrationStatus(
  id: string,
  apiStatus: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('integrations.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update integration status.' };
  }

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
  revalidatePath('/admin/cto');
  return { success: true };
}

export async function updateIntegrationIncidentStatus(
  id: string,
  incidentStatus: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('integrations.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update integration incident status.' };
  }

  if (!VALID_INCIDENT_STATUSES.has(incidentStatus)) {
    return { success: false, message: 'Invalid incident status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('integration_health').update({ incident_status: incidentStatus }).eq('id', id);

  if (error) {
    console.error('Failed to update integration incident status', id, error);
    return { success: false, message: 'Failed to update incident status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_incident_status',
    module: 'integration_health',
    recordId: id,
    newValue: { incidentStatus },
  });

  revalidatePath('/admin/integration-health');
  return { success: true };
}
