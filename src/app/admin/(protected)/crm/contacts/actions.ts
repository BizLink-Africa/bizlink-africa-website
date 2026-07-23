'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

export interface ClientContactInput {
  clientId: string;
  fullName: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  notes?: string;
}

export async function createClientContact(input: ClientContactInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('clients.update');
  } catch {
    return { success: false, message: 'You do not have permission to manage client contacts.' };
  }

  if (!input.fullName.trim()) {
    return { success: false, message: 'Full name is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_contacts')
    .insert({
      client_id: input.clientId,
      full_name: input.fullName.trim().slice(0, MAX_TEXT_LENGTH),
      role_title: input.roleTitle?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      email: input.email?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      phone: input.phone?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      is_primary: input.isPrimary ?? false,
      notes: input.notes?.trim() || null,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create client contact', error);
    return { success: false, message: 'Failed to create contact.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'client_contacts',
    recordId: data.id,
    newValue: { fullName: input.fullName, clientId: input.clientId },
  });

  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath('/admin/crm/contacts');
  return { success: true, id: data.id };
}

export async function deleteClientContact(id: string, clientId: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('clients.update');
  } catch {
    return { success: false, message: 'You do not have permission to manage client contacts.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('client_contacts').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete client contact', id, error);
    return { success: false, message: 'Failed to delete contact.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'delete',
    module: 'client_contacts',
    recordId: id,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath('/admin/crm/contacts');
  return { success: true };
}
