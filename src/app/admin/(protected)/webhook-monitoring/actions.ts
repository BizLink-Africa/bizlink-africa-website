'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { WEBHOOK_DELIVERY_STATUSES } from '@/data/webhooks';

const VALID_STATUSES = new Set<string>(WEBHOOK_DELIVERY_STATUSES.map((s) => s.value));

export interface WebhookDeliveryInput {
  clientId?: string;
  endpoint: string;
  event: string;
  deliveryStatus: string;
  responseSummary?: string;
  retryCount?: number;
  failureReason?: string;
  nextRetryAt?: string;
}

export async function createWebhookDelivery(input: WebhookDeliveryInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('webhooks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record webhook deliveries.' };
  }

  if (!input.endpoint?.trim() || !input.event?.trim()) {
    return { success: false, message: 'Endpoint and event are required.' };
  }
  if (!VALID_STATUSES.has(input.deliveryStatus)) {
    return { success: false, message: 'Invalid delivery status.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .insert({
      client_id: input.clientId || null,
      endpoint: input.endpoint.trim(),
      event: input.event.trim(),
      delivery_status: input.deliveryStatus,
      response_summary: input.responseSummary?.trim() || null,
      retry_count: input.retryCount ?? 0,
      failure_reason: input.failureReason?.trim() || null,
      next_retry_at: input.nextRetryAt || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create webhook delivery record', error);
    return { success: false, message: 'Failed to record webhook delivery.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'webhook_deliveries',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/webhook-monitoring');
  revalidatePath('/admin/cto');
  return { success: true };
}

export async function updateWebhookDeliveryStatus(id: string, deliveryStatus: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('webhooks.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update webhook delivery status.' };
  }

  if (!VALID_STATUSES.has(deliveryStatus)) {
    return { success: false, message: 'Invalid delivery status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('webhook_deliveries').update({ delivery_status: deliveryStatus }).eq('id', id);

  if (error) {
    console.error('Failed to update webhook delivery status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'webhook_deliveries',
    recordId: id,
    newValue: { deliveryStatus },
  });

  revalidatePath('/admin/webhook-monitoring');
  revalidatePath('/admin/cto');
  return { success: true };
}
