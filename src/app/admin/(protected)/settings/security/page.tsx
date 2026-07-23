import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SecuritySettingsForm from '@/components/admin/SecuritySettingsForm';
import type { SecuritySettingsInput } from './actions';

export const dynamic = 'force-dynamic';

interface SecuritySettingsRow {
  security_password_min_length: number;
  security_password_require_uppercase: boolean;
  security_password_require_number: boolean;
  security_password_require_symbol: boolean;
  security_mfa_required: boolean;
  security_session_timeout_minutes: number;
  security_max_login_attempts: number;
  security_lockout_duration_minutes: number;
  security_ip_allowlist: string | null;
  security_data_retention_days: number;
}

export default async function SecuritySettingsPage() {
  let canManage = true;
  try {
    await requirePermission('security.settings.view');
  } catch {
    return <AccessDenied requiredPermission="security.settings.view" />;
  }
  try {
    await requirePermission('security.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('company_settings')
    .select('security_password_min_length, security_password_require_uppercase, security_password_require_number, security_password_require_symbol, security_mfa_required, security_session_timeout_minutes, security_max_login_attempts, security_lockout_duration_minutes, security_ip_allowlist, security_data_retention_days')
    .eq('id', true)
    .single();

  const settings = data as SecuritySettingsRow | null;
  const initial: SecuritySettingsInput = {
    passwordMinLength: settings?.security_password_min_length ?? 8,
    passwordRequireUppercase: settings?.security_password_require_uppercase ?? true,
    passwordRequireNumber: settings?.security_password_require_number ?? true,
    passwordRequireSymbol: settings?.security_password_require_symbol ?? false,
    mfaRequired: settings?.security_mfa_required ?? false,
    sessionTimeoutMinutes: settings?.security_session_timeout_minutes ?? 60,
    maxLoginAttempts: settings?.security_max_login_attempts ?? 5,
    lockoutDurationMinutes: settings?.security_lockout_duration_minutes ?? 15,
    ipAllowlist: settings?.security_ip_allowlist ?? '',
    dataRetentionDays: settings?.security_data_retention_days ?? 365,
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Security Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          Password policy, MFA, session/login limits, IP restrictions, and data retention. Live session activity is
          tracked on <Link href="/admin/security/sessions" className="underline hover:text-[#00342b]">Session Monitoring</Link>.
        </p>
      </div>

      {canManage ? (
        <SecuritySettingsForm initial={initial} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Minimum Password Length:</span> {initial.passwordMinLength}</p>
          <p><span className="font-semibold text-[#707975]">MFA Required:</span> {initial.mfaRequired ? 'Yes' : 'No'}</p>
          <p><span className="font-semibold text-[#707975]">Session Timeout:</span> {initial.sessionTimeoutMinutes} min</p>
          <p><span className="font-semibold text-[#707975]">Max Login Attempts:</span> {initial.maxLoginAttempts}</p>
          <p><span className="font-semibold text-[#707975]">Lockout Duration:</span> {initial.lockoutDurationMinutes} min</p>
          <p><span className="font-semibold text-[#707975]">Data Retention:</span> {initial.dataRetentionDays} days</p>
        </div>
      )}
    </div>
  );
}
