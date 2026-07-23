'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { ContractStatus } from '@/data/contracts';

const MAX_TEXT_LENGTH = 200;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface ContractInput {
  contractTitle: string;
  clientId?: string;
  leadId?: string;
  proformaId?: string;
  invoiceId?: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  contractValue?: number;
  currency: string;
  paymentTerms?: string;
  contractOwner?: string;
  operationsOwner?: string;
  renewalNoticePeriodDays?: number;
  notes?: string;
  merchantAgentName?: string;
  outletName?: string;
  businessName?: string;
  businessRegistrationNumber?: string;
  mainProductsOrServices?: string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  region?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  contactName?: string;
  contactDesignation?: string;
  contactPhone?: string;
  contactEmail?: string;
  notificationPhone?: string;
  notificationEmail?: string;
  businessType?: string;
  yearOfIncorporation?: number;
  yearsOfOperation?: number;
}

export async function createContract(input: ContractInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('contracts.create');
  } catch {
    return { success: false, message: 'You do not have permission to create contracts.' };
  }

  if (!isNonEmptyString(input.contractTitle)) {
    return { success: false, message: 'Contract title is required.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'CON' });
  if (numberError || !numberData) {
    console.error('Failed to generate contract number', numberError);
    return { success: false, message: 'Failed to generate a contract number.' };
  }

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      contract_number: numberData,
      contract_title: input.contractTitle.trim().slice(0, MAX_TEXT_LENGTH),
      client_id: input.clientId || null,
      lead_id: input.leadId || null,
      proforma_id: input.proformaId || null,
      invoice_id: input.invoiceId || null,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      renewal_date: input.renewalDate || null,
      contract_value: input.contractValue ?? null,
      currency: input.currency,
      payment_terms: input.paymentTerms?.trim() || null,
      contract_owner: input.contractOwner?.trim() || null,
      operations_owner: input.operationsOwner?.trim() || null,
      renewal_notice_period_days: input.renewalNoticePeriodDays ?? 30,
      notes: input.notes?.trim() || null,
      merchant_agent_name: input.merchantAgentName?.trim() || null,
      outlet_name: input.outletName?.trim() || null,
      business_name: input.businessName?.trim() || null,
      business_registration_number: input.businessRegistrationNumber?.trim() || null,
      main_products_or_services: input.mainProductsOrServices?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      district: input.district?.trim() || null,
      ward: input.ward?.trim() || null,
      region: input.region?.trim() || null,
      gps_latitude: input.gpsLatitude ?? null,
      gps_longitude: input.gpsLongitude ?? null,
      contact_name: input.contactName?.trim() || null,
      contact_designation: input.contactDesignation?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      notification_phone: input.notificationPhone?.trim() || null,
      notification_email: input.notificationEmail?.trim() || null,
      business_type: input.businessType?.trim() || null,
      year_of_incorporation: input.yearOfIncorporation ?? null,
      years_of_operation: input.yearsOfOperation ?? null,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create contract', error);
    return { success: false, message: 'Failed to create contract.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'contracts',
    recordId: data.id,
    newValue: { contractNumber: numberData, title: input.contractTitle },
  });

  revalidatePath('/admin/contracts');
  return { success: true, id: data.id };
}

function permissionForContractStatus(status: ContractStatus): string {
  if (status === 'pending_ceo_approval') return 'contracts.compliance_review';
  if (status === 'approved') return 'contracts.approve';
  if (status === 'renewed') return 'contracts.renew';
  if (status === 'terminated') return 'contracts.terminate';
  return 'contracts.update';
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<{ success: boolean; message?: string }> {
  const permission = permissionForContractStatus(status);
  let user;
  try {
    user = await requirePermission(permission);
  } catch {
    return { success: false, message: 'You do not have permission to perform this action.' };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === 'approved') updates.approved_by = user.email;
  if (status === 'signed') updates.signed_date = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from('contracts').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update contract status', id, error);
    return { success: false, message: 'Failed to update contract status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'contracts',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/contracts');
  revalidatePath(`/admin/contracts/${id}`);
  return { success: true };
}

// Uploads a new contract file version to the private 'contract-files'
// storage bucket, records it in contract_versions, and bumps the
// contract's current_version counter. File type/size are validated
// server-side — the browser input's `accept` attribute is a UX hint only,
// never trusted.
export async function uploadContractVersion(
  contractId: string,
  formData: FormData
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('contracts.update');
  } catch {
    return { success: false, message: 'You do not have permission to upload contract files.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: 'Please select a file.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, message: 'File is too large (max 20MB).' };
  }
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return { success: false, message: 'Only PDF and Word documents are allowed.' };
  }

  const supabase = await createClient();
  const { data: contract, error: fetchError } = await supabase
    .from('contracts')
    .select('current_version')
    .eq('id', contractId)
    .single();

  if (fetchError || !contract) {
    return { success: false, message: 'Contract not found.' };
  }

  const nextVersion = contract.current_version + 1;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath = `${contractId}/v${nextVersion}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('contract-files')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('Failed to upload contract file', contractId, uploadError);
    return { success: false, message: 'Failed to upload file.' };
  }

  const { error: versionError } = await supabase.from('contract_versions').insert({
    contract_id: contractId,
    version_number: nextVersion,
    file_path: storagePath,
    file_name: file.name.slice(0, MAX_TEXT_LENGTH),
    uploaded_by: user.email,
  });

  if (versionError) {
    console.error('Failed to record contract version', contractId, versionError);
    return { success: false, message: 'File uploaded, but failed to record the version.' };
  }

  await supabase.from('contracts').update({ current_version: nextVersion }).eq('id', contractId);

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'upload_version',
    module: 'contracts',
    recordId: contractId,
    newValue: { version: nextVersion, fileName: file.name },
  });

  revalidatePath(`/admin/contracts/${contractId}`);
  return { success: true };
}

export interface AmendmentInput {
  description: string;
  effectiveDate?: string;
}

// A lightweight log of changes to an active/signed contract that don't
// warrant moving it through the full draft->approval status machine again
// (see the contract_amendments migration for why this is a separate table
// rather than a new contracts.status value).
export async function logContractAmendment(contractId: string, input: AmendmentInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('contracts.update');
  } catch {
    return { success: false, message: 'You do not have permission to log a contract amendment.' };
  }

  if (!isNonEmptyString(input.description)) {
    return { success: false, message: 'Description is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('contract_amendments').insert({
    contract_id: contractId,
    description: input.description.trim().slice(0, MAX_TEXT_LENGTH),
    effective_date: input.effectiveDate || null,
    requested_by: user.email,
  });

  if (error) {
    console.error('Failed to log contract amendment', contractId, error);
    return { success: false, message: 'Failed to log amendment.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'log_amendment',
    module: 'contracts',
    recordId: contractId,
    newValue: { description: input.description },
  });

  revalidatePath(`/admin/contracts/${contractId}`);
  return { success: true };
}

export async function getContractFileUrl(filePath: string): Promise<{ success: boolean; url?: string; message?: string }> {
  try {
    await requirePermission('contracts.view');
  } catch {
    return { success: false, message: 'You do not have permission to view contract files.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('contract-files').createSignedUrl(filePath, 60);

  if (error || !data) {
    return { success: false, message: 'Failed to generate a download link.' };
  }

  return { success: true, url: data.signedUrl };
}

export interface SensitiveDetailsInput {
  tin?: string;
  tinRegistrationDate?: string;
  nida?: string;
  businessLicenceNumber?: string;
  businessLicenceExpiryDate?: string;
  monthlyTurnover?: number;
  dailyCashCollection?: number;
  usesMobileMoney: boolean;
  mobileMoneyProviders?: string;
  dailyMobileMoneyCollection?: number;
  usesPos: boolean;
  posProviderName?: string;
  dailyPosCollection?: number;
  internationalCardAcceptanceReason?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}

// Deliberately logs only that a change happened, never the values — this
// data lives in a separately-permissioned table specifically so it isn't
// broadly readable, and audit_logs.view is a much less restrictive
// permission than contracts.sensitive.view. Logging the actual NIDA/bank
// details here would defeat that isolation entirely.
export async function saveSensitiveDetails(
  contractId: string,
  input: SensitiveDetailsInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('contracts.sensitive.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage merchant KYC/banking details.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('contract_sensitive_details').upsert(
    {
      contract_id: contractId,
      tin: input.tin?.trim() || null,
      tin_registration_date: input.tinRegistrationDate || null,
      nida: input.nida?.trim() || null,
      business_licence_number: input.businessLicenceNumber?.trim() || null,
      business_licence_expiry_date: input.businessLicenceExpiryDate || null,
      monthly_turnover: input.monthlyTurnover ?? null,
      daily_cash_collection: input.dailyCashCollection ?? null,
      uses_mobile_money: input.usesMobileMoney,
      mobile_money_providers: input.mobileMoneyProviders?.trim() || null,
      daily_mobile_money_collection: input.dailyMobileMoneyCollection ?? null,
      uses_pos: input.usesPos,
      pos_provider_name: input.posProviderName?.trim() || null,
      daily_pos_collection: input.dailyPosCollection ?? null,
      international_card_acceptance_reason: input.internationalCardAcceptanceReason?.trim() || null,
      bank_name: input.bankName?.trim() || null,
      bank_branch: input.bankBranch?.trim() || null,
      bank_account_name: input.bankAccountName?.trim() || null,
      bank_account_number: input.bankAccountNumber?.trim() || null,
      updated_by: user.email,
    },
    { onConflict: 'contract_id' }
  );

  if (error) {
    console.error('Failed to save contract sensitive details', contractId, error);
    return { success: false, message: 'Failed to save details.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_sensitive_details',
    module: 'contracts',
    recordId: contractId,
    newValue: { note: 'Merchant KYC/banking details updated — values withheld from audit log by design.' },
  });

  revalidatePath(`/admin/contracts/${contractId}`);
  return { success: true };
}
