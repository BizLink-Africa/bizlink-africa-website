'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { MERCHANT_DOCUMENT_TYPES, type MerchantOnboardingStatus } from '@/data/merchantOperations';

const MAX_TEXT_LENGTH = 200;
const MAX_NOTE_LENGTH = 2000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface MerchantApplicationInput {
  businessName: string;
  tradingName?: string;
  registrationType?: string;
  tin?: string;
  licenceNumber?: string;
  businessCategory?: string;
  contactPersonName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessAddress?: string;
  expectedVolume?: string;
}

// Creates the merchant record BizLink's own onboarding coordination starts
// from — this is a staff-entered application, separate from (and earlier
// than) the merchant portal account a representative signs into later.
export async function createMerchantApplication(
  input: MerchantApplicationInput
): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('merchants.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create merchant applications.' };
  }

  if (!isNonEmptyString(input.businessName)) {
    return { success: false, message: 'Business name is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('merchants')
    .insert({
      business_name: input.businessName.trim().slice(0, MAX_TEXT_LENGTH),
      trading_name: input.tradingName?.trim() || null,
      registration_type: input.registrationType || null,
      tin: input.tin?.trim() || null,
      licence_number: input.licenceNumber?.trim() || null,
      business_category: input.businessCategory?.trim() || null,
      contact_person_name: input.contactPersonName?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      business_address: input.businessAddress?.trim() || null,
      expected_volume: input.expectedVolume || null,
      onboarding_status: 'application_received',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create merchant application', error);
    return { success: false, message: 'Failed to create merchant application.' };
  }

  // Seed the document checklist so every merchant starts with the same
  // known set of rows — the checklist UI never has to guess what "not
  // started" looks like for a type it hasn't seen yet.
  await supabase.from('merchant_documents').insert(
    MERCHANT_DOCUMENT_TYPES.map((doc) => ({ merchant_id: data.id, document_type: doc.value, status: 'pending' }))
  );

  await supabase.from('merchant_status_history').insert({
    merchant_id: data.id,
    from_status: null,
    to_status: 'application_received',
    note: 'Application created.',
    changed_by: user.email ?? 'unknown',
  });

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'merchants',
    recordId: data.id,
    newValue: { businessName: input.businessName },
  });

  revalidatePath('/admin/merchant-operations/applications');
  revalidatePath('/admin/merchant-operations/profiles');
  return { success: true, id: data.id };
}

export interface MerchantProfileInput extends MerchantApplicationInput {
  riskStatus?: string;
  partnerMerchantReference?: string;
  tillReference?: string;
}

export async function updateMerchantProfile(
  id: string,
  input: MerchantProfileInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchants.manage');
  } catch {
    return { success: false, message: 'You do not have permission to edit merchant profiles.' };
  }

  if (!isNonEmptyString(input.businessName)) {
    return { success: false, message: 'Business name is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('merchants')
    .update({
      business_name: input.businessName.trim().slice(0, MAX_TEXT_LENGTH),
      trading_name: input.tradingName?.trim() || null,
      registration_type: input.registrationType || null,
      tin: input.tin?.trim() || null,
      licence_number: input.licenceNumber?.trim() || null,
      business_category: input.businessCategory?.trim() || null,
      contact_person_name: input.contactPersonName?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      business_address: input.businessAddress?.trim() || null,
      expected_volume: input.expectedVolume || null,
      risk_status: input.riskStatus || 'medium',
      partner_merchant_reference: input.partnerMerchantReference?.trim() || null,
      till_reference: input.tillReference?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update merchant profile', id, error);
    return { success: false, message: 'Failed to update merchant profile.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_profile',
    module: 'merchants',
    recordId: id,
    newValue: { businessName: input.businessName },
  });

  revalidatePath('/admin/merchant-operations/profiles');
  revalidatePath(`/admin/merchant-operations/profiles/${id}`);
  return { success: true };
}

// Always writes a matching merchant_status_history row alongside the
// status update — the history can never drift from what onboarding_status
// actually is, same convention as Technical Incidents' updateIncidentStatus.
export async function updateMerchantStatus(
  id: string,
  status: MerchantOnboardingStatus,
  note?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchants.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change merchant status.' };
  }

  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from('merchants')
    .select('onboarding_status')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return { success: false, message: 'Merchant not found.' };
  }

  const { error } = await supabase.from('merchants').update({ onboarding_status: status }).eq('id', id);
  if (error) {
    console.error('Failed to update merchant status', id, error);
    return { success: false, message: 'Failed to update merchant status.' };
  }

  await supabase.from('merchant_status_history').insert({
    merchant_id: id,
    from_status: current.onboarding_status,
    to_status: status,
    note: note?.trim().slice(0, MAX_NOTE_LENGTH) || null,
    changed_by: user.email ?? 'unknown',
  });

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'status_change',
    module: 'merchants',
    recordId: id,
    newValue: { from: current.onboarding_status, to: status },
  });

  revalidatePath('/admin/merchant-operations/applications');
  revalidatePath('/admin/merchant-operations/profiles');
  revalidatePath(`/admin/merchant-operations/profiles/${id}`);
  return { success: true };
}

export async function assignMerchantStaff(id: string, staffId: string | null): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchants.manage');
  } catch {
    return { success: false, message: 'You do not have permission to assign staff.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('merchants').update({ assigned_staff_id: staffId || null }).eq('id', id);
  if (error) {
    console.error('Failed to assign merchant staff', id, error);
    return { success: false, message: 'Failed to assign staff.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'assign_staff',
    module: 'merchants',
    recordId: id,
    newValue: { assignedStaffId: staffId },
  });

  revalidatePath(`/admin/merchant-operations/profiles/${id}`);
  return { success: true };
}

// Compliance hold is its own permission (merchants.compliance_hold), not
// merchants.manage — a distinct, deliberately narrower capability than
// general profile editing or status changes.
export async function setMerchantComplianceHold(
  id: string,
  hold: boolean,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchants.compliance_hold');
  } catch {
    return { success: false, message: 'You do not have permission to place or release a compliance hold.' };
  }

  if (hold && !isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required to place a compliance hold.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('merchants')
    .update({ compliance_hold: hold, compliance_hold_reason: hold ? (reason ?? '').trim().slice(0, MAX_NOTE_LENGTH) : null })
    .eq('id', id);

  if (error) {
    console.error('Failed to update merchant compliance hold', id, error);
    return { success: false, message: 'Failed to update compliance hold.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: hold ? 'compliance_hold_placed' : 'compliance_hold_released',
    module: 'merchants',
    recordId: id,
    newValue: hold ? { reason } : null,
  });

  revalidatePath(`/admin/merchant-operations/profiles/${id}`);
  return { success: true };
}

export async function addMerchantNote(id: string, note: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchants.manage');
  } catch {
    return { success: false, message: 'You do not have permission to add notes.' };
  }

  if (!isNonEmptyString(note)) {
    return { success: false, message: 'Note text is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('merchant_notes').insert({
    merchant_id: id,
    note: note.trim().slice(0, MAX_NOTE_LENGTH),
    created_by: user.email ?? 'unknown',
  });

  if (error) {
    console.error('Failed to add merchant note', id, error);
    return { success: false, message: 'Failed to add note.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'add_note',
    module: 'merchants',
    recordId: id,
  });

  revalidatePath(`/admin/merchant-operations/profiles/${id}`);
  return { success: true };
}

export async function updateMerchantDocumentStatus(
  merchantId: string,
  documentType: string,
  status: string,
  notes?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchants.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update the document checklist.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('merchant_documents').upsert(
    {
      merchant_id: merchantId,
      document_type: documentType,
      status,
      notes: notes?.trim() || null,
      updated_by: user.email ?? 'unknown',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'merchant_id,document_type' }
  );

  if (error) {
    console.error('Failed to update merchant document status', merchantId, documentType, error);
    return { success: false, message: 'Failed to update document status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_document_status',
    module: 'merchants',
    recordId: merchantId,
    newValue: { documentType, status },
  });

  revalidatePath(`/admin/merchant-operations/profiles/${merchantId}`);
  return { success: true };
}
