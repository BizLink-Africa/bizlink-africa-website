import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import CompanySettingsForm from '@/components/admin/CompanySettingsForm';

export const dynamic = 'force-dynamic';

interface CompanySettings {
  business_name: string;
  business_email: string;
  support_email: string;
  phone_whatsapp: string;
  location: string;
}

function SettingsCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
      <div>
        <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">{title}</h2>
        {note && <p className="text-xs text-[#707975] mt-1">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('company_settings').select('*').eq('id', true).single();
  const settings = data as CompanySettings | null;

  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Not configured';
  const notificationRecipient = process.env.BIZLINK_NOTIFICATION_EMAIL ?? 'Not configured';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'Not configured';

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          Company Profile and Contact Details are editable and persisted. The remaining sections reflect real
          configuration but are reference-only — most are backed by environment variables or infrastructure, not
          admin-editable data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <CompanySettingsForm
            initialBusinessName={settings?.business_name ?? ''}
            initialBusinessEmail={settings?.business_email ?? ''}
            initialSupportEmail={settings?.support_email ?? ''}
            initialPhoneWhatsapp={settings?.phone_whatsapp ?? ''}
            initialLocation={settings?.location ?? ''}
          />
        </div>

        <SettingsCard title="Email Settings" note="Managed via environment variables — never edited here.">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-[#e5e5e5]"><td className="py-2 pr-4 text-[#707975] w-48">Resend API Key</td><td className="py-2">{resendConfigured ? 'Configured' : 'Not configured'}</td></tr>
              <tr className="border-b border-[#e5e5e5]"><td className="py-2 pr-4 text-[#707975]">From Address</td><td className="py-2">{fromEmail}</td></tr>
              <tr><td className="py-2 pr-4 text-[#707975]">Notification Recipient</td><td className="py-2">{notificationRecipient}</td></tr>
            </tbody>
          </table>
        </SettingsCard>

        <SettingsCard title="WhatsApp Settings" note="Driven by the Contact Details phone number above.">
          <p className="text-sm text-[#3f4945]">
            {settings?.phone_whatsapp ?? '—'} — links generated as{' '}
            <span className="font-mono text-xs">wa.me/{(settings?.phone_whatsapp ?? '').replace(/\D/g, '')}</span>
          </p>
        </SettingsCard>

        <SettingsCard title="Brand Settings" note="Reference palette — changing colors here would require a full theming system, not built yet.">
          <div className="flex gap-3 flex-wrap">
            {[
              { hex: '#00342b', label: 'Deep Green' },
              { hex: '#004d40', label: 'Hover Green' },
              { hex: '#afefdd', label: 'Mint Accent' },
              { hex: '#1b1c1c', label: 'Black' },
              { hex: '#f5f3f3', label: 'Off White' },
            ].map((c) => (
              <div key={c.hex} className="text-center">
                <div className="w-12 h-12 border border-[#bfc9c4]" style={{ backgroundColor: c.hex }} />
                <p className="text-[10px] text-[#707975] mt-1">{c.label}</p>
              </div>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard title="User Roles" note="Managed on the Staff & Roles page, not duplicated here.">
          <p className="text-sm text-[#3f4945]">
            Super Admin, Admin, Sales Staff, Technical Staff, Support Staff, Compliance Officer.
          </p>
          <Link href="/admin/staff" className="inline-block mt-2 text-sm text-[#00342b] hover:underline">
            Manage staff & roles →
          </Link>
        </SettingsCard>

        <SettingsCard title="Security Settings" note="Describes current behavior — not a toggle.">
          <p className="text-sm text-[#3f4945] leading-relaxed">
            Any signed-in Supabase Auth user has full access to this dashboard. There is no per-role permission
            enforcement yet — roles assigned on the Staff & Roles page are labels, not access controls. Session
            cookies are refreshed by the proxy layer; the real authorization check runs on every server request via{' '}
            <span className="font-mono text-xs">verifyAdminSession()</span>.
          </p>
        </SettingsCard>

        <SettingsCard title="Notification Settings">
          <p className="text-sm text-[#3f4945] leading-relaxed">
            Inquiry notifications are sent to {notificationRecipient} only. No CC, no BCC, and no client confirmation
            email is sent. This policy is enforced in code, not configurable from this page.
          </p>
        </SettingsCard>

        <SettingsCard title="Supabase Settings" note="Project URL only — API keys are never shown here.">
          <p className="text-sm text-[#3f4945] font-mono break-all">{supabaseUrl}</p>
        </SettingsCard>

        <SettingsCard title="Compliance Settings">
          <div className="bg-[#f5f3f3] border-l-4 border-[#00342b] px-4 py-3">
            <p className="text-sm text-[#1b1c1c] leading-relaxed">
              BizLink Africa provides ICT infrastructure, automation systems, and integration support only. BizLink
              Africa does not hold, receive, control, or settle client funds.
            </p>
          </div>
          <ul className="text-sm text-[#3f4945] list-disc pl-5 space-y-1 mt-3">
            <li>Public website never names payment partners or shows their logos.</li>
            <li>Public website never displays pricing.</li>
            <li>Client settlements happen directly between the client and their approved payment partner.</li>
          </ul>
        </SettingsCard>
      </div>
    </div>
  );
}
