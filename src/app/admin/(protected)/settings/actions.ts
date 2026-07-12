'use server';

import { revalidatePath } from 'next/cache';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

export interface CompanySettingsInput {
  businessName: string;
  businessEmail: string;
  supportEmail: string;
  phoneWhatsapp: string;
  location: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function updateCompanySettings(
  input: CompanySettingsInput
): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();

  if (
    !isNonEmptyString(input.businessName) ||
    !isNonEmptyString(input.businessEmail) ||
    !isNonEmptyString(input.supportEmail) ||
    !isNonEmptyString(input.phoneWhatsapp) ||
    !isNonEmptyString(input.location)
  ) {
    return { success: false, message: 'All fields are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      business_name: input.businessName.trim().slice(0, MAX_TEXT_LENGTH),
      business_email: input.businessEmail.trim().slice(0, MAX_TEXT_LENGTH),
      support_email: input.supportEmail.trim().slice(0, MAX_TEXT_LENGTH),
      phone_whatsapp: input.phoneWhatsapp.trim().slice(0, MAX_TEXT_LENGTH),
      location: input.location.trim().slice(0, MAX_TEXT_LENGTH),
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update company settings', error);
    return { success: false, message: 'Failed to save settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings');
  return { success: true };
}
