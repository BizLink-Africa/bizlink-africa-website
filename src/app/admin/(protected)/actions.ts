'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { INQUIRY_STATUSES, PRIORITY_LEVELS } from '@/data/inquiries';
import { ONBOARDING_CHECKLIST_ITEMS, type OnboardingChecklistKey } from '@/data/clients';

const VALID_STATUSES = new Set<string>(INQUIRY_STATUSES.map((s) => s.value));
const VALID_PRIORITIES = new Set<string>(PRIORITY_LEVELS.map((p) => p.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ASSIGNED_TO_LENGTH = 200;

export interface InquiryUpdates {
  status?: string;
  adminNotes?: string;
  priority?: string;
  followUpDate?: string | null;
  assignedTo?: string | null;
}

export async function updateInquiry(
  id: string,
  updates: InquiryUpdates
): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (updates.status && !VALID_STATUSES.has(updates.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  if (updates.priority && !VALID_PRIORITIES.has(updates.priority)) {
    return { success: false, message: 'Invalid priority.' };
  }

  if (updates.followUpDate && !ISO_DATE.test(updates.followUpDate)) {
    return { success: false, message: 'Invalid follow-up date.' };
  }

  const assignedTo = updates.assignedTo?.trim().slice(0, MAX_ASSIGNED_TO_LENGTH);

  const supabase = await createClient();
  const { error } = await supabase
    .from('website_leads')
    .update({
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.adminNotes !== undefined ? { admin_notes: updates.adminNotes } : {}),
      ...(updates.priority ? { priority: updates.priority } : {}),
      ...(updates.followUpDate !== undefined ? { follow_up_date: updates.followUpDate || null } : {}),
      ...(updates.assignedTo !== undefined ? { assigned_to: assignedTo || null } : {}),
      // Marking an inquiry "Contacted" is the moment worth recording — the
      // dashboard surfaces this as last_contacted_at without a separate
      // manual field for admins to remember to fill in.
      ...(updates.status === 'contacted' ? { last_contacted_at: new Date().toISOString() } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update inquiry', id, error);
    return { success: false, message: 'Failed to update inquiry.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'website_leads',
    recordId: id,
    newValue: updates,
  });

  revalidatePath('/admin/inquiries');
  revalidatePath(`/admin/inquiries/${id}`);
  return { success: true };
}

// Turns a lead into a client: creates the clients row (pre-filled from the
// lead), links an onboarding checklist to it, and marks the lead
// active_client. Idempotent — re-clicking "Convert to Client" on an
// already-converted lead just returns the existing client instead of
// creating a duplicate.
export async function convertLeadToClient(
  leadId: string
): Promise<{ success: boolean; message?: string; clientId?: string }> {
  const user = await verifyAdminSession();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (existing) {
    return { success: true, clientId: existing.id };
  }

  const { data: lead, error: leadError } = await supabase
    .from('website_leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return { success: false, message: 'Lead not found.' };
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      lead_id: lead.id,
      client_name: lead.full_name,
      business_name: lead.business_name,
      business_type: lead.business_type,
      contact_person: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      location: lead.location,
    })
    .select('id')
    .single();

  if (clientError || !client) {
    console.error('Failed to convert lead to client', leadId, clientError);
    return { success: false, message: 'Failed to convert lead to client.' };
  }

  const { error: checklistError } = await supabase
    .from('onboarding_checklists')
    .upsert({ lead_id: lead.id, client_id: client.id }, { onConflict: 'lead_id' });

  if (checklistError) {
    console.error('Failed to link onboarding checklist for converted lead', leadId, checklistError);
  }

  const { error: statusError } = await supabase
    .from('website_leads')
    .update({ status: 'active_client' })
    .eq('id', leadId);

  if (statusError) {
    console.error('Failed to mark converted lead as active_client', leadId, statusError);
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'convert_to_client',
    module: 'website_leads',
    recordId: leadId,
    newValue: { clientId: client.id },
  });

  revalidatePath('/admin/inquiries');
  revalidatePath(`/admin/inquiries/${leadId}`);
  revalidatePath('/admin/clients');
  revalidatePath(`/admin/clients/${client.id}`);

  return { success: true, clientId: client.id };
}

const VALID_CHECKLIST_KEYS = new Set<string>(ONBOARDING_CHECKLIST_ITEMS.map((i) => i.key));

// Shared by the lead detail page and the client detail page — the checklist
// row is upserted on whichever owner column applies, so the first toggle
// lazily creates the row and every toggle after that just updates it.
export async function toggleOnboardingChecklistItem(
  owner: { leadId: string } | { clientId: string },
  key: OnboardingChecklistKey,
  value: boolean
): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (!VALID_CHECKLIST_KEYS.has(key)) {
    return { success: false, message: 'Invalid checklist item.' };
  }

  const supabase = await createClient();
  const isLead = 'leadId' in owner;
  const { error } = await supabase
    .from('onboarding_checklists')
    .upsert(
      isLead ? { lead_id: owner.leadId, [key]: value } : { client_id: owner.clientId, [key]: value },
      { onConflict: isLead ? 'lead_id' : 'client_id' }
    );

  if (error) {
    console.error('Failed to update onboarding checklist', owner, key, error);
    return { success: false, message: 'Failed to update checklist.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_checklist',
    module: 'onboarding_checklists',
    recordId: isLead ? owner.leadId : owner.clientId,
    newValue: { [key]: value },
  });

  if (isLead) {
    revalidatePath(`/admin/inquiries/${owner.leadId}`);
  } else {
    revalidatePath(`/admin/clients/${owner.clientId}`);
  }
  return { success: true };
}
