import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { verifyAdminSession } from '@/lib/supabase/dal';

// Step-up auth for sensitive money-movement actions. A freshness marker,
// not the authentication event itself — the real re-verification is the
// signInWithPassword() call wherever this is issued (e.g.
// reauthenticateForBeneficiaries(), reauthenticateForPayouts()); this just
// lets a later request check "was that done recently," scoped by purpose so
// a beneficiary-access re-auth can't be reused to approve a payout.
export const REAUTH_PURPOSE = 'beneficiary_access';
export const PAYOUT_REAUTH_PURPOSE = 'payout_approval';
export const SETTLEMENT_EMERGENCY_REAUTH_PURPOSE = 'settlement_emergency_action';
export const SELCOM_INTEGRATION_REAUTH_PURPOSE = 'selcom_integration_management';
export const REAUTH_TTL_MINUTES = 10;

export async function hasRecentReauth(purpose: string = REAUTH_PURPOSE): Promise<boolean> {
  const user = await verifyAdminSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from('staff_reauth_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('purpose', purpose)
    .gt('expires_at', new Date().toISOString())
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!data;
}
