'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export interface UserSessionInput {
  staffId: string;
  device?: string;
  ipAddress?: string;
}

export async function recordUserSession(input: UserSessionInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('sessions.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record sessions.' };
  }

  if (!input.staffId) {
    return { success: false, message: 'A staff member is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      staff_id: input.staffId,
      device: input.device?.trim() || null,
      ip_address: input.ipAddress?.trim() || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to record session', error);
    return { success: false, message: 'Failed to record session.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'user_sessions',
    recordId: data.id,
  });

  revalidatePath('/admin/security/sessions');
  revalidatePath('/admin/security');
  return { success: true };
}

// This is the "Security can revoke sessions when authorized" capability —
// gated by sessions.manage and always audit-logged. See the migration's
// header comment for why this is a tracked/audited app-level workflow
// rather than a claim of killing a real Supabase Auth session: this app has
// no safe way to do that without storing a raw session JWT somewhere, which
// would itself be the plaintext-secret exposure this module must prevent.
export async function revokeSession(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('sessions.manage');
  } catch {
    return { success: false, message: 'You do not have permission to revoke sessions.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('user_sessions')
    .update({ revoked: true, revoked_by: user.email, revoked_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Failed to revoke session', id, error);
    return { success: false, message: 'Failed to revoke session.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'revoke',
    module: 'user_sessions',
    recordId: id,
  });

  revalidatePath('/admin/security/sessions');
  revalidatePath('/admin/security');
  return { success: true };
}
