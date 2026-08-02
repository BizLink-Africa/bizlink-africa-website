'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAuditEvent } from '@/lib/audit';
import { IDENTITY_DOCUMENT_TYPE } from '@/data/merchantOperations';

const BUCKET = 'merchant-kyc-documents';
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const SIGNED_URL_TTL_SECONDS = 60;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// A caller with merchant_kyc_documents.manage can request/upload/review any
// checklist item. Whether they can also VIEW the identity document itself
// is a separate, stricter permission — checked here for a clear error
// message, and independently re-enforced by storage.objects RLS even if
// this check were ever bypassed.
async function requireDocumentViewAccess(documentType: string) {
  const user = await requirePermission('merchant_kyc_documents.view');
  if (documentType === IDENTITY_DOCUMENT_TYPE) {
    await requirePermission('merchant_kyc_identity_documents.view');
  }
  return user;
}

export async function requestDocument(merchantId: string, documentType: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_kyc_documents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to request KYC documents.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('merchant_documents').upsert(
    { merchant_id: merchantId, document_type: documentType, status: 'requested', updated_by: user.email ?? 'unknown', updated_at: new Date().toISOString() },
    { onConflict: 'merchant_id,document_type' }
  );

  if (error) {
    console.error('Failed to request KYC document', merchantId, documentType, error);
    return { success: false, message: 'Failed to request document.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'request_document',
    module: 'merchant_documents',
    recordId: merchantId,
    newValue: { documentType },
  });

  revalidatePath(`/admin/merchant-operations/kyc/${merchantId}`);
  return { success: true };
}

export async function updateChecklistStatus(
  merchantId: string,
  documentType: string,
  status: string,
  notes?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_kyc_documents.manage');
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
    console.error('Failed to update KYC checklist status', merchantId, documentType, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_document_status',
    module: 'merchant_documents',
    recordId: merchantId,
    newValue: { documentType, status },
  });

  revalidatePath(`/admin/merchant-operations/kyc/${merchantId}`);
  return { success: true };
}

// Uploads are never overwritten in place: every upload/replace inserts a
// new merchant_document_files row and flips the previous current row to
// is_current=false, so a "replace" is always distinguishable from an
// "upload" in the audit trail and version history is never lost.
export async function uploadKycDocument(
  merchantId: string,
  documentType: string,
  formData: FormData
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_kyc_documents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to upload KYC documents.' };
  }
  if (documentType === IDENTITY_DOCUMENT_TYPE) {
    try {
      await requirePermission('merchant_kyc_identity_documents.view');
    } catch {
      return { success: false, message: 'You do not have permission to upload the identity document.' };
    }
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: 'Please select a file.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, message: 'File is too large (max 15MB).' };
  }
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return { success: false, message: 'Only PDF, JPEG, and PNG files are allowed.' };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('merchant_document_files')
    .select('id, version_number')
    .eq('merchant_id', merchantId)
    .eq('document_type', documentType)
    .eq('is_current', true)
    .maybeSingle();

  const nextVersion = (existing?.version_number ?? 0) + 1;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath = `${merchantId}/${documentType}/v${nextVersion}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('Failed to upload KYC document to storage', merchantId, documentType, uploadError);
    return { success: false, message: 'Failed to upload file.' };
  }

  if (existing) {
    await supabase.from('merchant_document_files').update({ is_current: false }).eq('id', existing.id);
  }

  const { error: insertError } = await supabase.from('merchant_document_files').insert({
    merchant_id: merchantId,
    document_type: documentType,
    version_number: nextVersion,
    storage_path: storagePath,
    file_name: file.name.slice(0, 200),
    file_size_bytes: file.size,
    mime_type: file.type,
    is_current: true,
    uploaded_by: user.email ?? 'unknown',
  });

  if (insertError) {
    console.error('Failed to record KYC document file metadata', merchantId, documentType, insertError);
    return { success: false, message: 'File uploaded, but failed to record it. Contact a Super Admin.' };
  }

  await supabase.from('merchant_documents').upsert(
    { merchant_id: merchantId, document_type: documentType, status: 'uploaded', updated_by: user.email ?? 'unknown', updated_at: new Date().toISOString() },
    { onConflict: 'merchant_id,document_type' }
  );

  // Metadata only — file name and type, never file content — matches the
  // "no document data in logs" requirement.
  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: existing ? 'replace_document' : 'upload_document',
    module: 'merchant_document_files',
    recordId: merchantId,
    newValue: { documentType, fileName: file.name, version: nextVersion },
  });

  revalidatePath(`/admin/merchant-operations/kyc/${merchantId}`);
  return { success: true };
}

// A signed URL is short-lived (60s) and is the only way this bucket is
// ever reachable — the bucket is private and no code anywhere constructs a
// public URL for it. Generating one IS the "view" event this module must
// audit; what the browser does with the URL afterward (inline view vs.
// save-as download) isn't observable server-side, so both are logged
// identically here.
export async function getKycDocumentSignedUrl(fileId: string): Promise<{ success: boolean; url?: string; message?: string }> {
  const supabase = await createClient();
  const { data: file, error: fetchError } = await supabase
    .from('merchant_document_files')
    .select('id, merchant_id, document_type, storage_path, deleted_at')
    .eq('id', fileId)
    .single();

  if (fetchError || !file) {
    return { success: false, message: 'File not found.' };
  }
  if (file.deleted_at) {
    return { success: false, message: 'This file has been deleted.' };
  }

  let user;
  try {
    user = await requireDocumentViewAccess(file.document_type);
  } catch {
    return { success: false, message: 'You do not have permission to view this document.' };
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error('Failed to create signed URL for KYC document', fileId, error);
    return { success: false, message: 'Failed to generate a download link.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'view_document',
    module: 'merchant_document_files',
    recordId: file.merchant_id,
    newValue: { documentType: file.document_type, fileId },
  });

  return { success: true, url: data.signedUrl };
}

// Retention/deletion workflow: a reason is required, the storage object is
// actually removed (not just hidden), and the DB row is soft-deleted
// (deleted_at/deleted_by/deletion_reason) rather than dropped outright, so
// the fact that a document existed and was deleted stays in the record.
// Storage has no DELETE policy for `authenticated` at all (see the
// migration), so this step must use the service-role client — this file
// never runs in the browser (it's a 'use server' action), so the
// credential never reaches frontend code.
export async function deleteKycDocumentFile(fileId: string, reason: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_kyc_documents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to delete KYC documents.' };
  }

  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required to delete a document.' };
  }

  const supabase = await createClient();
  const { data: file, error: fetchError } = await supabase
    .from('merchant_document_files')
    .select('id, merchant_id, document_type, storage_path')
    .eq('id', fileId)
    .single();

  if (fetchError || !file) {
    return { success: false, message: 'File not found.' };
  }

  const serviceClient = createServiceClient();
  const { error: removeError } = await serviceClient.storage.from(BUCKET).remove([file.storage_path]);
  if (removeError) {
    console.error('Failed to remove KYC document from storage', fileId, removeError);
    return { success: false, message: 'Failed to delete the file from storage.' };
  }

  const { error: updateError } = await supabase
    .from('merchant_document_files')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.email ?? 'unknown', deletion_reason: reason.trim().slice(0, 500) })
    .eq('id', fileId);

  if (updateError) {
    console.error('Failed to record KYC document deletion', fileId, updateError);
    return { success: false, message: 'File removed from storage, but failed to record the deletion. Contact a Super Admin.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'delete_document',
    module: 'merchant_document_files',
    recordId: file.merchant_id,
    newValue: { documentType: file.document_type, reason },
  });

  revalidatePath(`/admin/merchant-operations/kyc/${file.merchant_id}`);
  return { success: true };
}

// Placeholder only — no real malware scanning is integrated. This lets
// staff manually record the outcome of an out-of-band scan (or explicitly
// mark one as skipped) until a real scanning service (e.g. ClamAV,
// VirusTotal, a cloud AV API) is wired in as part of the upload path.
// Never infer or default to 'clean' automatically.
export async function updateMalwareScanStatus(fileId: string, status: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_kyc_documents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update malware scan status.' };
  }

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from('merchant_document_files')
    .update({ malware_scan_status: status })
    .eq('id', fileId)
    .select('merchant_id, document_type')
    .single();

  if (error || !file) {
    console.error('Failed to update malware scan status', fileId, error);
    return { success: false, message: 'Failed to update scan status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_malware_scan_status',
    module: 'merchant_document_files',
    recordId: file.merchant_id,
    newValue: { documentType: file.document_type, status },
  });

  revalidatePath(`/admin/merchant-operations/kyc/${file.merchant_id}`);
  return { success: true };
}

// Never logs the consent text itself — only that a consent event was
// recorded and which version of the consent text it referred to.
export async function recordConsent(
  merchantId: string,
  consentGiven: boolean,
  consentTextVersion: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_kyc_documents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record consent.' };
  }

  if (!isNonEmptyString(consentTextVersion)) {
    return { success: false, message: 'Consent text version is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('merchant_data_processing_consent').insert({
    merchant_id: merchantId,
    consent_given: consentGiven,
    consent_text_version: consentTextVersion.trim().slice(0, 100),
    recorded_by: user.email ?? 'unknown',
  });

  if (error) {
    console.error('Failed to record consent', merchantId, error);
    return { success: false, message: 'Failed to record consent.' };
  }

  await supabase.from('merchant_documents').upsert(
    {
      merchant_id: merchantId,
      document_type: 'data_processing_consent',
      status: consentGiven ? 'uploaded' : 'incomplete',
      updated_by: user.email ?? 'unknown',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'merchant_id,document_type' }
  );

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'record_consent',
    module: 'merchant_data_processing_consent',
    recordId: merchantId,
    newValue: { consentGiven, consentTextVersion },
  });

  revalidatePath(`/admin/merchant-operations/kyc/${merchantId}`);
  return { success: true };
}
