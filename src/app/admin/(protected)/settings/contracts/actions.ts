'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export interface ContractSettingsInput {
  contractPrefix: string;
  renewalNoticeDays: number;
  expiryNoticeDays: number;
  requiredApprovalRoles: string[];
}

export async function updateContractSettings(input: ContractSettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('contract.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change contract settings.' };
  }

  if (!input.contractPrefix.trim()) {
    return { success: false, message: 'Contract prefix is required.' };
  }
  if (input.renewalNoticeDays < 0 || input.expiryNoticeDays < 0) {
    return { success: false, message: 'Notice periods cannot be negative.' };
  }
  if (input.requiredApprovalRoles.length === 0) {
    return { success: false, message: 'At least one required approval role must be selected.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      contract_prefix: input.contractPrefix.trim().toUpperCase().slice(0, 10),
      contract_renewal_notice_days: input.renewalNoticeDays,
      contract_expiry_notice_days: input.expiryNoticeDays,
      contract_required_approval_roles: input.requiredApprovalRoles,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update contract settings', error);
    return { success: false, message: 'Failed to save contract settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings/contracts');
  return { success: true };
}
