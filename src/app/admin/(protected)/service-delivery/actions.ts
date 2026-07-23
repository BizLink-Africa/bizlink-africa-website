'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { DELIVERY_STATUSES, type DeliveryStatus } from '@/data/services';

const VALID_DELIVERY_STATUSES = new Set<string>(DELIVERY_STATUSES.map((s) => s.value));
const MAX_TEXT_LENGTH = 200;

export interface ServiceDeliveryInput {
  deliveryStatus: DeliveryStatus;
  scheduledDate?: string;
  assignedTo?: string;
  deliveryNotes?: string;
}

export async function updateServiceDelivery(
  clientServiceId: string,
  input: ServiceDeliveryInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('services.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage service delivery.' };
  }

  if (!VALID_DELIVERY_STATUSES.has(input.deliveryStatus)) {
    return { success: false, message: 'Invalid delivery status.' };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from('client_services')
    .select('delivery_status, delivery_started_at, delivered_at')
    .eq('id', clientServiceId)
    .single();

  if (fetchError || !existing) {
    return { success: false, message: 'Service record not found.' };
  }

  const updates: Record<string, unknown> = {
    delivery_status: input.deliveryStatus,
    scheduled_date: input.scheduledDate || null,
    assigned_to: input.assignedTo?.trim().slice(0, MAX_TEXT_LENGTH) || null,
    delivery_notes: input.deliveryNotes?.trim() || null,
  };

  if (input.deliveryStatus === 'in_progress' && !existing.delivery_started_at) {
    updates.delivery_started_at = new Date().toISOString();
  }
  if (input.deliveryStatus === 'delivered' && !existing.delivered_at) {
    updates.delivered_at = new Date().toISOString();
  }
  if (input.deliveryStatus !== 'delivered') {
    updates.delivered_at = null;
  }

  const { error } = await supabase.from('client_services').update(updates).eq('id', clientServiceId);

  if (error) {
    console.error('Failed to update service delivery', clientServiceId, error);
    return { success: false, message: 'Failed to update delivery status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_delivery',
    module: 'client_services',
    recordId: clientServiceId,
    newValue: { deliveryStatus: input.deliveryStatus },
  });

  revalidatePath('/admin/service-delivery');
  revalidatePath('/admin/clients');
  return { success: true };
}
