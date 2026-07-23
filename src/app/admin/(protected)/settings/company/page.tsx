import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CompanySettingsForm from '@/components/admin/CompanySettingsForm';
import type { CompanySettingsInput } from './actions';

export const dynamic = 'force-dynamic';

interface CompanySettingsRow {
  business_name: string;
  business_email: string;
  support_email: string;
  phone_whatsapp: string;
  location: string;
  logo_url: string | null;
  business_registration_number: string | null;
  tax_identification_number: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
}

export default async function CompanySettingsPage() {
  let canManage = true;
  try {
    await requirePermission('company.settings.view');
  } catch {
    return <AccessDenied requiredPermission="company.settings.view" />;
  }
  try {
    await requirePermission('company.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('company_settings')
    .select('business_name, business_email, support_email, phone_whatsapp, location, logo_url, business_registration_number, tax_identification_number, brand_primary_color, brand_secondary_color')
    .eq('id', true)
    .single();

  const settings = data as CompanySettingsRow | null;
  const initial: CompanySettingsInput = {
    businessName: settings?.business_name ?? '',
    businessEmail: settings?.business_email ?? '',
    supportEmail: settings?.support_email ?? '',
    phoneWhatsapp: settings?.phone_whatsapp ?? '',
    location: settings?.location ?? '',
    logoUrl: settings?.logo_url ?? '',
    businessRegistrationNumber: settings?.business_registration_number ?? '',
    taxIdentificationNumber: settings?.tax_identification_number ?? '',
    brandPrimaryColor: settings?.brand_primary_color ?? '#00342b',
    brandSecondaryColor: settings?.brand_secondary_color ?? '#004d40',
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Company Settings</h1>
        <p className="text-sm text-[#707975] mt-1">Company identity, contact details, registration/tax details, and branding.</p>
      </div>

      {canManage ? (
        <CompanySettingsForm initial={initial} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Business Name:</span> {initial.businessName}</p>
          <p><span className="font-semibold text-[#707975]">Business Email:</span> {initial.businessEmail}</p>
          <p><span className="font-semibold text-[#707975]">Support Email:</span> {initial.supportEmail}</p>
          <p><span className="font-semibold text-[#707975]">Phone / WhatsApp:</span> {initial.phoneWhatsapp}</p>
          <p><span className="font-semibold text-[#707975]">Location:</span> {initial.location}</p>
          <p><span className="font-semibold text-[#707975]">Registration Number:</span> {initial.businessRegistrationNumber || '—'}</p>
          <p><span className="font-semibold text-[#707975]">Tax ID:</span> {initial.taxIdentificationNumber || '—'}</p>
        </div>
      )}
    </div>
  );
}
