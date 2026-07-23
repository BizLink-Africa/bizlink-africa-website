'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { PROVISIONING_STATUSES, CREDENTIAL_TYPES, type ProvisioningStatus, type CredentialType } from '@/data/operations';

const VALID_STATUSES = new Set<string>(PROVISIONING_STATUSES.map((s) => s.value));
const VALID_CREDENTIAL_TYPES = new Set<string>(CREDENTIAL_TYPES.map((t) => t.value));
const MAX_TEXT_LENGTH = 2000;

export interface ProvisioningProfileInput {
  clientId: string;
  enabledModules: string[];
  technicalOwner?: string;
  activationDate?: string;
  trainingStatus: ProvisioningStatus;
  handoverStatus: ProvisioningStatus;
  notes?: string;
}

// Upsert on client_id — one provisioning profile per client.
export async function saveProvisioningProfile(input: ProvisioningProfileInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('provisioning.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage client provisioning.' };
  }

  if (!VALID_STATUSES.has(input.trainingStatus) || !VALID_STATUSES.has(input.handoverStatus)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_provisioning')
    .upsert(
      {
        client_id: input.clientId,
        enabled_modules: input.enabledModules,
        technical_owner: input.technicalOwner || null,
        activation_date: input.activationDate || null,
        training_status: input.trainingStatus,
        handover_status: input.handoverStatus,
        notes: input.notes?.trim().slice(0, MAX_TEXT_LENGTH) || null,
        created_by: user.email,
      },
      { onConflict: 'client_id' }
    )
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to save provisioning profile', input.clientId, error);
    return { success: false, message: 'Failed to save provisioning profile.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'client_provisioning',
    recordId: data.id,
    newValue: { trainingStatus: input.trainingStatus, handoverStatus: input.handoverStatus },
  });

  revalidatePath('/admin/operations/provisioning');
  revalidatePath(`/admin/operations/provisioning/${input.clientId}`);
  return { success: true, id: data.id };
}

export interface AddCredentialInput {
  provisioningId: string;
  clientId: string;
  credentialType: CredentialType;
  label: string;
  secretValue: string;
}

function maskSecret(secret: string): string {
  const visible = secret.slice(-4);
  return `${'•'.repeat(Math.max(4, secret.length - 4))}${visible}`;
}

// The only write path for a credential's secret — encryption happens
// entirely inside insert_provisioning_credential() (a security-definer
// Postgres function). This action never stores the plaintext anywhere
// itself; it only forwards it into that one RPC call and discards it.
export async function addProvisioningCredential(input: AddCredentialInput): Promise<{ success: boolean; message?: string }> {
  try {
    await requirePermission('provisioning.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage credentials.' };
  }

  if (!VALID_CREDENTIAL_TYPES.has(input.credentialType)) {
    return { success: false, message: 'Invalid credential type.' };
  }
  if (!input.label.trim() || !input.secretValue.trim()) {
    return { success: false, message: 'Label and value are required.' };
  }

  const encryptionKey = process.env.PROVISIONING_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('PROVISIONING_ENCRYPTION_KEY is not configured');
    return { success: false, message: 'Credential storage is not configured. Contact an administrator.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('insert_provisioning_credential', {
    p_provisioning_id: input.provisioningId,
    p_credential_type: input.credentialType,
    p_label: input.label.trim().slice(0, 200),
    p_secret: input.secretValue.trim(),
    p_masked_preview: maskSecret(input.secretValue.trim()),
    p_encryption_key: encryptionKey,
  });

  if (error) {
    console.error('Failed to add provisioning credential', input.provisioningId, error);
    return { success: false, message: 'Failed to save credential.' };
  }

  revalidatePath(`/admin/operations/provisioning/${input.clientId}`);
  return { success: true };
}
