import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Re-verifies the session against Supabase Auth on every call (not just the
// cookie) — mirrors verifyAdminSession in dal.ts. Safe to gate real data
// access with. Cached per request.
export const verifyMerchantSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/merchant/login');
  }

  return user;
});

export interface MerchantProfile {
  merchantUserId: string;
  merchantId: string;
  businessName: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

// Single source of truth for the caller's merchant_users row (+ their
// merchant's business_name via a join). Returns null for an authenticated
// Supabase user with no merchant_users row at all — a signed-in account
// that isn't actually a provisioned merchant representative.
export const getMerchantProfile = cache(async (): Promise<MerchantProfile | null> => {
  const user = await verifyMerchantSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from('merchant_users')
    .select('id, merchant_id, full_name, role, is_active, merchants(business_name)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return null;

  const merchantRow = Array.isArray(data.merchants) ? data.merchants[0] : data.merchants;

  return {
    merchantUserId: data.id,
    merchantId: data.merchant_id,
    businessName: merchantRow?.business_name ?? 'Your business',
    fullName: data.full_name,
    role: data.role,
    isActive: data.is_active,
  };
});

// Gate for the protected merchant layout/pages and the terms-acceptance
// action. Redirects (rather than throwing) since it's meant to be called
// directly from a server component / the top of a server action.
export async function requireActiveMerchant(): Promise<MerchantProfile> {
  const profile = await getMerchantProfile();

  if (!profile || !profile.isActive) {
    redirect('/merchant/login?no_account=1');
  }

  return profile;
}
