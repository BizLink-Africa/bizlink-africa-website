'use server';

import { createClient } from '@/lib/supabase/server';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { SELCOM_INTEGRATION_REAUTH_PURPOSE, REAUTH_TTL_MINUTES } from '@/lib/supabase/reauth';

// Step-up re-authentication for the two consequential actions on this page
// (enabling/disabling the integration, requesting production activation) —
// same pattern as reauthenticateForPayouts(). The password re-entry via
// signInWithPassword() below IS the real re-authentication event; the row
// inserted afterward is just a short-lived marker that it happened.
export async function reauthenticateForSelcomIntegration(password: string): Promise<{ success: boolean; message?: string }> {
  const user = await verifyAdminSession();
  if (!user.email) {
    return { success: false, message: 'Unable to verify your account email.' };
  }
  if (!password) {
    return { success: false, message: 'Password is required.' };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (signInError) {
    return { success: false, message: 'Incorrect password.' };
  }

  const expiresAt = new Date(Date.now() + REAUTH_TTL_MINUTES * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from('staff_reauth_sessions').insert({
    user_id: user.id,
    purpose: SELCOM_INTEGRATION_REAUTH_PURPOSE,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('Failed to record Selcom integration reauth session', insertError);
    return { success: false, message: 'Failed to confirm re-authentication.' };
  }

  return { success: true };
}
