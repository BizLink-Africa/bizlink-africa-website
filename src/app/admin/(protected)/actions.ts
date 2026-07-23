'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession, requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { INQUIRY_STATUSES, PRIORITY_LEVELS, LEAD_STAGES, LEAD_SOURCES } from '@/data/inquiries';
import { ONBOARDING_CHECKLIST_ITEMS, type OnboardingChecklistKey } from '@/data/clients';

const VALID_STATUSES = new Set<string>(INQUIRY_STATUSES.map((s) => s.value));
const VALID_PRIORITIES = new Set<string>(PRIORITY_LEVELS.map((p) => p.value));
const VALID_STAGES = new Set<string>(LEAD_STAGES.map((s) => s.value));
const VALID_LEAD_SOURCES = new Set<string>(LEAD_SOURCES.map((s) => s.value));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface InquiryUpdates {
  status?: string;
  adminNotes?: string;
  priority?: string;
  followUpDate?: string | null;
  stage?: string;
  leadScore?: number;
  leadSource?: string | null;
}

export async function updateInquiry(
  id: string,
  updates: InquiryUpdates
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('leads.update');
  } catch {
    return { success: false, message: 'You do not have permission to update leads.' };
  }

  if (updates.status && !VALID_STATUSES.has(updates.status)) {
    return { success: false, message: 'Invalid status.' };
  }

  if (updates.priority && !VALID_PRIORITIES.has(updates.priority)) {
    return { success: false, message: 'Invalid priority.' };
  }

  if (updates.followUpDate && !ISO_DATE.test(updates.followUpDate)) {
    return { success: false, message: 'Invalid follow-up date.' };
  }

  if (updates.stage && !VALID_STAGES.has(updates.stage)) {
    return { success: false, message: 'Invalid stage.' };
  }

  if (updates.leadScore !== undefined && (!Number.isInteger(updates.leadScore) || updates.leadScore < 0 || updates.leadScore > 100)) {
    return { success: false, message: 'Lead score must be a whole number between 0 and 100.' };
  }

  if (updates.leadSource && !VALID_LEAD_SOURCES.has(updates.leadSource)) {
    return { success: false, message: 'Invalid lead source.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('website_leads')
    .update({
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.adminNotes !== undefined ? { admin_notes: updates.adminNotes } : {}),
      ...(updates.priority ? { priority: updates.priority } : {}),
      ...(updates.followUpDate !== undefined ? { follow_up_date: updates.followUpDate || null } : {}),
      ...(updates.stage ? { stage: updates.stage } : {}),
      ...(updates.leadScore !== undefined ? { lead_score: updates.leadScore } : {}),
      ...(updates.leadSource !== undefined ? { lead_source: updates.leadSource || null } : {}),
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

// Dedicated action for lead assignment, gated by leads.assign specifically
// (distinct from leads.update) — a role that can edit lead details doesn't
// automatically get to reassign ownership.
export async function assignLead(id: string, assignedUserId: string | null): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('leads.assign');
  } catch {
    return { success: false, message: 'You do not have permission to assign leads.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('website_leads').update({ assigned_user_id: assignedUserId || null }).eq('id', id);

  if (error) {
    console.error('Failed to assign lead', id, error);
    return { success: false, message: 'Failed to assign lead.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'assign',
    module: 'website_leads',
    recordId: id,
    newValue: { assignedUserId },
  });

  revalidatePath('/admin/inquiries');
  revalidatePath(`/admin/inquiries/${id}`);
  return { success: true };
}

// Links a lead to the marketing campaign that generated it.
export async function linkLeadCampaign(id: string, campaignId: string | null): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('leads.update');
  } catch {
    return { success: false, message: 'You do not have permission to update leads.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('website_leads').update({ campaign_id: campaignId || null }).eq('id', id);

  if (error) {
    console.error('Failed to link lead campaign', id, error);
    return { success: false, message: 'Failed to link campaign.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'link_campaign',
    module: 'website_leads',
    recordId: id,
    newValue: { campaignId },
  });

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
  let user;
  try {
    user = await requirePermission('leads.convert');
  } catch {
    return { success: false, message: 'You do not have permission to convert leads to clients.' };
  }
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

  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'CLI' });
  if (numberError || !numberData) {
    console.error('Failed to generate client number', numberError);
    return { success: false, message: 'Failed to generate a client number.' };
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
      client_number: numberData,
      // Continuity of ownership — whoever the lead was assigned to keeps
      // owning the resulting client, rather than starting unassigned.
      account_owner_id: lead.assigned_user_id ?? null,
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

const MAX_TEXT_LENGTH = 200;

export interface CreateLeadInput {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  businessType?: string;
  location?: string;
  leadSource?: string;
  assignedUserId?: string;
}

// Every existing lead so far came in through the public inquiry form
// (src/app/api/inquiries/route.ts). This is the staff-facing counterpart —
// for leads sourced any other way (referral, cold call, a trade event) that
// never touched that public form.
export async function createLead(input: CreateLeadInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('leads.create');
  } catch {
    return { success: false, message: 'You do not have permission to create leads.' };
  }

  if (!input.fullName.trim() || !input.businessName.trim() || !input.email.trim() || !input.phone.trim()) {
    return { success: false, message: 'Full name, business name, email, and phone are required.' };
  }

  if (input.leadSource && !VALID_LEAD_SOURCES.has(input.leadSource)) {
    return { success: false, message: 'Invalid lead source.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'LED' });
  if (numberError || !numberData) {
    console.error('Failed to generate lead number', numberError);
    return { success: false, message: 'Failed to generate a lead number.' };
  }

  const { data, error } = await supabase
    .from('website_leads')
    .insert({
      full_name: input.fullName.trim().slice(0, MAX_TEXT_LENGTH),
      business_name: input.businessName.trim().slice(0, MAX_TEXT_LENGTH),
      email: input.email.trim().slice(0, MAX_TEXT_LENGTH),
      phone: input.phone.trim().slice(0, MAX_TEXT_LENGTH),
      business_type: input.businessType?.trim() || null,
      location: input.location?.trim() || null,
      lead_source: input.leadSource || null,
      assigned_user_id: input.assignedUserId || null,
      lead_number: numberData,
      status: 'new',
      stage: 'new',
      notification_status: 'sent',
      consent_given: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create lead', error);
    return { success: false, message: 'Failed to create lead.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'website_leads',
    recordId: data.id,
    newValue: { leadNumber: numberData, businessName: input.businessName },
  });

  revalidatePath('/admin/inquiries');
  return { success: true, id: data.id };
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
