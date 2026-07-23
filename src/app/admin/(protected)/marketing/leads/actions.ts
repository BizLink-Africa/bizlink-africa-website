'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { LEAD_SOURCES, type LeadSource } from '@/data/inquiries';

const MAX_TEXT_LENGTH = 200;
const VALID_LEAD_SOURCES = new Set<string>(LEAD_SOURCES.map((s) => s.value));

export interface MarketingLeadInput {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  businessType?: string;
  location?: string;
  leadSource?: LeadSource;
  campaignId?: string;
  referralPartnerId?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// The CRM's existing createLead (app/admin/(protected)/actions.ts) has no
// duplicate check — deliberately left untouched (see plan). This is the
// dedicated, duplicate-checked creation path for the new Marketing Leads
// page: any existing website_leads row with a matching email OR phone
// blocks the insert and points back at the existing lead instead of
// silently creating a second one.
export async function createMarketingLead(input: MarketingLeadInput): Promise<{ success: boolean; message?: string; id?: string; duplicateLeadId?: string }> {
  let user;
  try {
    user = await requirePermission('leads.create');
  } catch {
    return { success: false, message: 'You do not have permission to create leads.' };
  }

  if (!isNonEmptyString(input.fullName) || !isNonEmptyString(input.businessName) || !isNonEmptyString(input.email) || !isNonEmptyString(input.phone)) {
    return { success: false, message: 'Full name, business name, email, and phone are required.' };
  }
  if (input.leadSource && !VALID_LEAD_SOURCES.has(input.leadSource)) {
    return { success: false, message: 'Invalid lead source.' };
  }

  const email = input.email.trim().toLowerCase().slice(0, MAX_TEXT_LENGTH);
  const phone = input.phone.trim().slice(0, MAX_TEXT_LENGTH);

  const supabase = await createClient();

  // Two separate exact-match lookups rather than a single .or() filter
  // string — email/phone are user-controlled input, and building a
  // PostgREST filter expression by string interpolation would let stray
  // commas/parentheses in either value corrupt the query.
  const [{ data: emailMatch }, { data: phoneMatch }] = await Promise.all([
    supabase.from('website_leads').select('id, business_name').eq('email', email).limit(1).maybeSingle(),
    supabase.from('website_leads').select('id, business_name').eq('phone', phone).limit(1).maybeSingle(),
  ]);
  const duplicate = emailMatch ?? phoneMatch;

  if (duplicate) {
    return {
      success: false,
      message: `A lead with this email or phone already exists (${duplicate.business_name}).`,
      duplicateLeadId: duplicate.id,
    };
  }

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
      email,
      phone,
      business_type: input.businessType?.trim() || null,
      location: input.location?.trim() || null,
      lead_source: input.leadSource || null,
      campaign_id: input.campaignId || null,
      referral_partner_id: input.referralPartnerId || null,
      lead_number: numberData,
      status: 'new',
      stage: 'new',
      notification_status: 'sent',
      consent_given: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create marketing lead', error);
    return { success: false, message: 'Failed to create lead.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'website_leads',
    recordId: data.id,
    newValue: { leadNumber: numberData, source: 'marketing' },
  });

  revalidatePath('/admin/marketing/leads');
  revalidatePath('/admin/inquiries');
  return { success: true, id: data.id };
}

export async function setLeadQualification(id: string, field: 'is_mql' | 'is_sql', value: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('leads.update');
  } catch {
    return { success: false, message: 'You do not have permission to update leads.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('website_leads').update({ [field]: value }).eq('id', id);

  if (error) {
    console.error('Failed to update lead qualification', id, field, error);
    return { success: false, message: 'Failed to update qualification.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: field === 'is_mql' ? 'set_mql' : 'set_sql',
    module: 'website_leads',
    recordId: id,
    newValue: { [field]: value },
  });

  revalidatePath('/admin/marketing/leads');
  return { success: true };
}
