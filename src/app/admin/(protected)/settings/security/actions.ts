'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export interface SecuritySettingsInput {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  ipAllowlist: string;
  dataRetentionDays: number;
}

export async function updateSecuritySettings(input: SecuritySettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('security.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change security settings.' };
  }

  if (input.passwordMinLength < 6) {
    return { success: false, message: 'Minimum password length must be at least 6.' };
  }
  if (input.sessionTimeoutMinutes <= 0 || input.maxLoginAttempts <= 0 || input.lockoutDurationMinutes <= 0 || input.dataRetentionDays <= 0) {
    return { success: false, message: 'Session, login, lockout, and retention values must be greater than zero.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      security_password_min_length: input.passwordMinLength,
      security_password_require_uppercase: input.passwordRequireUppercase,
      security_password_require_number: input.passwordRequireNumber,
      security_password_require_symbol: input.passwordRequireSymbol,
      security_mfa_required: input.mfaRequired,
      security_session_timeout_minutes: input.sessionTimeoutMinutes,
      security_max_login_attempts: input.maxLoginAttempts,
      security_lockout_duration_minutes: input.lockoutDurationMinutes,
      security_ip_allowlist: input.ipAllowlist.trim() || null,
      security_data_retention_days: input.dataRetentionDays,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update security settings', error);
    return { success: false, message: 'Failed to save security settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings/security');
  return { success: true };
}
