'use server';

import { createClient } from '@/lib/supabase/server';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { REAUTH_PURPOSE, REAUTH_TTL_MINUTES } from '@/lib/supabase/reauth';
import { assertArchivedFinancialPrototypeReadOnly } from '@/lib/archived-financial-prototype';

export async function reauthenticateForBeneficiaries(password: string): Promise<{ success: boolean; message?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  const user = await verifyAdminSession();
  if (!user.email) {
    return { success: false, message: 'Unable to verify your account email.' };
  }
  if (!password) {
    return { success: false, message: 'Password is required.' };
  }

  const supabase = await createClient();
  // Re-verifies the password against Supabase Auth directly — this is the
  // actual re-authentication event; the row inserted below is just a
  // short-lived record that it happened.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (signInError) {
    return { success: false, message: 'Incorrect password.' };
  }

  const expiresAt = new Date(Date.now() + REAUTH_TTL_MINUTES * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from('staff_reauth_sessions').insert({
    user_id: user.id,
    purpose: REAUTH_PURPOSE,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('Failed to record reauth session', insertError);
    return { success: false, message: 'Failed to confirm re-authentication.' };
  }

  return { success: true };
}
