'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { ProposalStatus } from '@/data/crm';

const MAX_TEXT_LENGTH = 200;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

export interface ProposalInput {
  leadId?: string;
  clientId?: string;
  services: string[];
  scope?: string;
  pricingSummaryTotal: number;
  currency: string;
  pricingNotes?: string;
  validUntil?: string;
  relatedProformaId?: string;
  relatedContractId?: string;
}

export async function createProposal(input: ProposalInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('proposals.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create proposals.' };
  }

  if (!input.clientId && !input.leadId) {
    return { success: false, message: 'A proposal must be linked to a client or a lead.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'PRP' });
  if (numberError || !numberData) {
    console.error('Failed to generate proposal number', numberError);
    return { success: false, message: 'Failed to generate a proposal number.' };
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      proposal_number: numberData,
      lead_id: input.leadId || null,
      client_id: input.clientId || null,
      services: input.services,
      scope: input.scope?.trim() || null,
      pricing_summary_total: input.pricingSummaryTotal,
      currency: input.currency,
      pricing_notes: input.pricingNotes?.trim() || null,
      valid_until: input.validUntil || null,
      related_proforma_id: input.relatedProformaId || null,
      related_contract_id: input.relatedContractId || null,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create proposal', error);
    return { success: false, message: 'Failed to create proposal.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'proposals',
    recordId: data.id,
    newValue: { proposalNumber: numberData, total: input.pricingSummaryTotal },
  });

  revalidatePath('/admin/crm/proposals');
  return { success: true, id: data.id };
}

export async function updateProposalStatus(
  id: string,
  status: ProposalStatus,
  clientResponse?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('proposals.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update proposals.' };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === 'approved') updates.approved_by = user.email;
  if (status === 'sent') updates.sent_date = new Date().toISOString().slice(0, 10);
  if (clientResponse !== undefined) updates.client_response = clientResponse.trim() || null;

  const { error } = await supabase.from('proposals').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update proposal status', id, error);
    return { success: false, message: 'Failed to update proposal status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'proposals',
    recordId: id,
    newValue: { status, clientResponse: clientResponse?.trim() || null },
  });

  revalidatePath('/admin/crm/proposals');
  revalidatePath(`/admin/crm/proposals/${id}`);
  return { success: true };
}

// Mirrors uploadContractVersion exactly — same private-bucket-upload +
// version-row + counter-bump pattern already established for contracts.
export async function uploadProposalVersion(proposalId: string, formData: FormData): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('proposals.manage');
  } catch {
    return { success: false, message: 'You do not have permission to upload proposal files.' };
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
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('current_version')
    .eq('id', proposalId)
    .single();

  if (fetchError || !proposal) {
    return { success: false, message: 'Proposal not found.' };
  }

  const nextVersion = proposal.current_version + 1;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const storagePath = `${proposalId}/v${nextVersion}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('proposal-files')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('Failed to upload proposal file', proposalId, uploadError);
    return { success: false, message: 'Failed to upload file.' };
  }

  const { error: versionError } = await supabase.from('proposal_versions').insert({
    proposal_id: proposalId,
    version_number: nextVersion,
    file_path: storagePath,
    file_name: file.name.slice(0, MAX_TEXT_LENGTH),
    uploaded_by: user.email,
  });

  if (versionError) {
    console.error('Failed to record proposal version', proposalId, versionError);
    return { success: false, message: 'File uploaded, but failed to record the version.' };
  }

  await supabase.from('proposals').update({ current_version: nextVersion }).eq('id', proposalId);

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'upload_version',
    module: 'proposals',
    recordId: proposalId,
    newValue: { version: nextVersion, fileName: file.name },
  });

  revalidatePath(`/admin/crm/proposals/${proposalId}`);
  return { success: true };
}
