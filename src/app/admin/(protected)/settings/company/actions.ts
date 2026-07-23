'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

export interface CompanySettingsInput {
  businessName: string;
  businessEmail: string;
  supportEmail: string;
  phoneWhatsapp: string;
  location: string;
  logoUrl?: string;
  businessRegistrationNumber?: string;
  taxIdentificationNumber?: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export async function updateCompanySettings(input: CompanySettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('company.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change company settings.' };
  }

  if (
    !isNonEmptyString(input.businessName) ||
    !isNonEmptyString(input.businessEmail) ||
    !isNonEmptyString(input.supportEmail) ||
    !isNonEmptyString(input.phoneWhatsapp) ||
    !isNonEmptyString(input.location)
  ) {
    return { success: false, message: 'Business name, contact details, and location are required.' };
  }
  if (!HEX_COLOR.test(input.brandPrimaryColor) || !HEX_COLOR.test(input.brandSecondaryColor)) {
    return { success: false, message: 'Brand colors must be valid hex codes (e.g. #00342b).' };
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
      logo_url: input.logoUrl?.trim() || null,
      business_registration_number: input.businessRegistrationNumber?.trim() || null,
      tax_identification_number: input.taxIdentificationNumber?.trim() || null,
      brand_primary_color: input.brandPrimaryColor,
      brand_secondary_color: input.brandSecondaryColor,
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

  revalidatePath('/admin/settings/company');
  return { success: true };
}
