'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { ONBOARDING_STATUSES, INTEGRATION_STATUSES } from '@/data/clients';
import { SERVICE_CATALOG, SERVICE_STATUSES } from '@/data/services';

const VALID_ONBOARDING_STATUSES = new Set<string>(ONBOARDING_STATUSES.map((s) => s.value));
const VALID_INTEGRATION_STATUSES = new Set<string>(INTEGRATION_STATUSES.map((s) => s.value));
const VALID_SERVICE_KEYS = new Set<string>(SERVICE_CATALOG.map((s) => s.value));
const VALID_SERVICE_STATUSES = new Set<string>(SERVICE_STATUSES.map((s) => s.value));
const MAX_TEXT_LENGTH = 200;

export interface ClientInput {
  clientName: string;
  businessName: string;
  businessType?: string;
  contactPerson?: string;
  email: string;
  phone: string;
  location?: string;
  assignedStaff?: string;
  internalNotes?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createClientRecord(
  input: ClientInput
): Promise<{ success: boolean; message?: string; clientId?: string }> {
  const user = await verifyAdminSession();

  if (!isNonEmptyString(input.clientName) || !isNonEmptyString(input.businessName) || !isNonEmptyString(input.email) || !isNonEmptyString(input.phone)) {
    return { success: false, message: 'Client name, business name, email, and phone are required.' };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('clients')
    .insert({
      client_name: input.clientName.trim().slice(0, MAX_TEXT_LENGTH),
      business_name: input.businessName.trim().slice(0, MAX_TEXT_LENGTH),
      business_type: input.businessType?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      contact_person: input.contactPerson?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      email: input.email.trim().slice(0, MAX_TEXT_LENGTH),
      phone: input.phone.trim().slice(0, MAX_TEXT_LENGTH),
      location: input.location?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      assigned_staff: input.assignedStaff?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      internal_notes: input.internalNotes?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create client', error);
    return { success: false, message: 'Failed to create client.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'clients',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/clients');
  return { success: true, clientId: data.id };
}

export interface ClientUpdates {
  clientName?: string;
  businessName?: string;
  businessType?: string | null;
  contactPerson?: string | null;
  email?: string;
  phone?: string;
  location?: string | null;
  onboardingStatus?: string;
  integrationStatus?: string;
  assignedStaff?: string | null;
  internalNotes?: string | null;
}

export async function updateClientRecord(
  id: string,
  updates: ClientUpdates
): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (updates.onboardingStatus && !VALID_ONBOARDING_STATUSES.has(updates.onboardingStatus)) {
    return { success: false, message: 'Invalid onboarding status.' };
  }
  if (updates.integrationStatus && !VALID_INTEGRATION_STATUSES.has(updates.integrationStatus)) {
    return { success: false, message: 'Invalid integration status.' };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from('clients')
    .update({
      ...(updates.clientName !== undefined ? { client_name: updates.clientName.trim().slice(0, MAX_TEXT_LENGTH) } : {}),
      ...(updates.businessName !== undefined ? { business_name: updates.businessName.trim().slice(0, MAX_TEXT_LENGTH) } : {}),
      ...(updates.businessType !== undefined ? { business_type: updates.businessType?.trim().slice(0, MAX_TEXT_LENGTH) || null } : {}),
      ...(updates.contactPerson !== undefined ? { contact_person: updates.contactPerson?.trim().slice(0, MAX_TEXT_LENGTH) || null } : {}),
      ...(updates.email !== undefined ? { email: updates.email.trim().slice(0, MAX_TEXT_LENGTH) } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone.trim().slice(0, MAX_TEXT_LENGTH) } : {}),
      ...(updates.location !== undefined ? { location: updates.location?.trim().slice(0, MAX_TEXT_LENGTH) || null } : {}),
      ...(updates.onboardingStatus ? { onboarding_status: updates.onboardingStatus } : {}),
      ...(updates.integrationStatus ? { integration_status: updates.integrationStatus } : {}),
      ...(updates.assignedStaff !== undefined ? { assigned_staff: updates.assignedStaff?.trim().slice(0, MAX_TEXT_LENGTH) || null } : {}),
      ...(updates.internalNotes !== undefined ? { internal_notes: updates.internalNotes?.trim() || null } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update client', id, error);
    return { success: false, message: 'Failed to update client.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'clients',
    recordId: id,
    newValue: updates,
  });

  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${id}`);
  return { success: true };
}

export async function setClientActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from('clients').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to set client active status', id, error);
    return { success: false, message: 'Failed to update client status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_active_status',
    module: 'clients',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${id}`);
  return { success: true };
}

export async function updateClientService(
  clientId: string,
  serviceKey: string,
  status: string
): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!VALID_SERVICE_KEYS.has(serviceKey)) {
    return { success: false, message: 'Invalid service.' };
  }
  if (!VALID_SERVICE_STATUSES.has(status)) {
    return { success: false, message: 'Invalid service status.' };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from('client_services').upsert(
    {
      client_id: clientId,
      service_key: serviceKey,
      status,
      activated_at: status === 'active' ? new Date().toISOString() : null,
    },
    { onConflict: 'client_id,service_key' }
  );

  if (error) {
    console.error('Failed to update client service', clientId, serviceKey, error);
    return { success: false, message: 'Failed to update service.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_service',
    module: 'client_services',
    recordId: clientId,
    newValue: { serviceKey, status },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath('/admin/services');
  return { success: true };
}
