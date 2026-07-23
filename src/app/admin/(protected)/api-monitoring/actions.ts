'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { HTTP_METHODS, ERROR_CATEGORIES } from '@/data/apiLogs';
import { ENVIRONMENTS } from '@/data/integrations';
import { maskSecrets } from '@/lib/security/mask';

const VALID_METHODS = new Set<string>(HTTP_METHODS);
const VALID_ERROR_CATEGORIES = new Set<string>(ERROR_CATEGORIES.map((e) => e.value));
const VALID_ENVIRONMENTS = new Set<string>(ENVIRONMENTS.map((e) => e.value));

export interface ApiLogInput {
  clientId?: string;
  endpoint: string;
  method: string;
  responseCode: number;
  responseTimeMs?: number;
  correlationId?: string;
  errorCategory?: string;
  retryCount?: number;
  environment?: string;
}

export async function createApiLog(input: ApiLogInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('api_logs.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record API log entries.' };
  }

  if (!input.endpoint?.trim()) {
    return { success: false, message: 'Endpoint is required.' };
  }
  if (!VALID_METHODS.has(input.method)) {
    return { success: false, message: 'Invalid HTTP method.' };
  }
  if (!Number.isInteger(input.responseCode) || input.responseCode < 100 || input.responseCode > 599) {
    return { success: false, message: 'Invalid response code.' };
  }
  if (input.errorCategory && !VALID_ERROR_CATEGORIES.has(input.errorCategory)) {
    return { success: false, message: 'Invalid error category.' };
  }
  if (input.environment && !VALID_ENVIRONMENTS.has(input.environment)) {
    return { success: false, message: 'Invalid environment.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('api_request_logs')
    .insert({
      client_id: input.clientId || null,
      endpoint: input.endpoint.trim(),
      method: input.method,
      response_code: input.responseCode,
      response_time_ms: input.responseTimeMs ?? null,
      correlation_id: input.correlationId?.trim() || null,
      error_category: input.errorCategory || 'none',
      retry_count: input.retryCount ?? 0,
      environment: input.environment || 'production',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create API log entry', error);
    return { success: false, message: 'Failed to record API log entry.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'api_request_logs',
    recordId: data.id,
    newValue: { ...input, endpoint: maskSecrets(input.endpoint) },
  });

  revalidatePath('/admin/api-monitoring');
  revalidatePath('/admin/cto');
  return { success: true };
}
