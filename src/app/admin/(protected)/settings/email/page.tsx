import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import EmailSettingsForm from '@/components/admin/EmailSettingsForm';
import type { EmailSettingsInput } from './actions';

export const dynamic = 'force-dynamic';

interface EmailSettingsRow {
  email_sender_name: string;
  email_sender_address: string | null;
  email_proforma_enabled: boolean;
  email_invoice_enabled: boolean;
  email_contract_enabled: boolean;
  email_support_enabled: boolean;
}

export default async function EmailSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('email.settings.view');
  } catch {
    return <AccessDenied requiredPermission="email.settings.view" />;
  }
  try {
    await requirePermission('email.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('company_settings')
    .select('email_sender_name, email_sender_address, email_proforma_enabled, email_invoice_enabled, email_contract_enabled, email_support_enabled')
    .eq('id', true)
    .single();

  const settings = data as EmailSettingsRow | null;
  const initial: EmailSettingsInput = {
    senderName: settings?.email_sender_name ?? 'BizLink Africa',
    senderAddress: settings?.email_sender_address ?? '',
    proformaEnabled: settings?.email_proforma_enabled ?? true,
    invoiceEnabled: settings?.email_invoice_enabled ?? true,
    contractEnabled: settings?.email_contract_enabled ?? true,
    supportEnabled: settings?.email_support_enabled ?? true,
  };

  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Email Settings</h1>
        <p className="text-sm text-[#707975] mt-1">Sender identity and which document templates send email. Credentials are never shown here.</p>
      </div>

      {canManage ? (
        <EmailSettingsForm initial={initial} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Sender Name:</span> {initial.senderName}</p>
          <p><span className="font-semibold text-[#707975]">Sender Address:</span> {initial.senderAddress || '—'}</p>
          <p><span className="font-semibold text-[#707975]">Proforma Email:</span> {initial.proformaEnabled ? 'On' : 'Off'}</p>
          <p><span className="font-semibold text-[#707975]">Invoice Email:</span> {initial.invoiceEnabled ? 'On' : 'Off'}</p>
          <p><span className="font-semibold text-[#707975]">Contract Email:</span> {initial.contractEnabled ? 'On' : 'Off'}</p>
          <p><span className="font-semibold text-[#707975]">Support Email:</span> {initial.supportEnabled ? 'On' : 'Off'}</p>
        </div>
      )}

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
        <h2 className="font-semibold text-[#00342b]">Provider Status</h2>
        <p className="text-xs text-[#707975]">Managed via environment variables — never editable or shown here.</p>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-[#e5e5e5]">
              <td className="py-2 pr-4 text-[#707975] w-48">Resend API Key</td>
              <td className="py-2">{resendConfigured ? 'Configured' : 'Not configured'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
