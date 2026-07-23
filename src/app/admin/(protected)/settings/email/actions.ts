'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

export interface EmailSettingsInput {
  senderName: string;
  senderAddress: string;
  proformaEnabled: boolean;
  invoiceEnabled: boolean;
  contractEnabled: boolean;
  supportEnabled: boolean;
}

export async function updateEmailSettings(input: EmailSettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('email.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change email settings.' };
  }

  if (!input.senderName.trim()) {
    return { success: false, message: 'Sender name is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      email_sender_name: input.senderName.trim().slice(0, MAX_TEXT_LENGTH),
      email_sender_address: input.senderAddress.trim() || null,
      email_proforma_enabled: input.proformaEnabled,
      email_invoice_enabled: input.invoiceEnabled,
      email_contract_enabled: input.contractEnabled,
      email_support_enabled: input.supportEnabled,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update email settings', error);
    return { success: false, message: 'Failed to save email settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings/email');
  return { success: true };
}
