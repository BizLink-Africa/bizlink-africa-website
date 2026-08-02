'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireActiveMerchant, verifyMerchantSession } from '@/lib/supabase/merchant-dal';
import { logAuditEvent } from '@/lib/audit';
import { computeDocumentHash } from '@/lib/legal/document-hash';
import { TERMS_VERSION, PRIVACY_VERSION, MERCHANT_ACKNOWLEDGEMENT_KEYS } from '@/data/legal';

export interface AcceptTermsResult {
  success: boolean;
  message: string;
}

// Server-side re-validation of every acknowledgement — the client form
// disables submit until all are checked, but that is UI convenience only,
// never trusted here.
function allAcknowledged(acknowledgements: Record<string, boolean>): boolean {
  return MERCHANT_ACKNOWLEDGEMENT_KEYS.every((key) => acknowledgements[key] === true);
}

export async function acceptMerchantTerms(acknowledgements: Record<string, boolean>): Promise<AcceptTermsResult> {
  // Redirects to /merchant/login if there is no session or no active
  // merchant_users row — merchant_id below always comes from this, never
  // from client input, so acceptance can never be recorded against a
  // different merchant than the signed-in representative's own.
  const merchant = await requireActiveMerchant();
  const user = await verifyMerchantSession();

  if (!allAcknowledged(acknowledgements)) {
    return { success: false, message: 'Please confirm all required acknowledgements before continuing.' };
  }

  const headerList = await headers();
  const ipAddress = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = headerList.get('user-agent') || null;

  const documentHash = computeDocumentHash(TERMS_VERSION, PRIVACY_VERSION);

  // Inserted through the merchant's own session-bound (RLS-scoped) client,
  // not the service role — the "Merchant can accept terms for their own
  // merchant only" policy re-derives and checks merchant_id independently
  // of everything already validated above.
  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from('merchant_terms_acceptances')
    .insert({
      merchant_id: merchant.merchantId,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      accepted_by_name: merchant.fullName,
      accepted_by_user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      acknowledgements,
      document_hash: documentHash,
    })
    .select('id, accepted_at')
    .single();

  if (error || !inserted) {
    console.error('Failed to record merchant terms acceptance', error);
    return { success: false, message: 'Something went wrong recording your acceptance. Please try again.' };
  }

  // audit_logs INSERT is gated by is_active_staff() — a merchant's own
  // session client would be rejected by RLS here, so this write goes
  // through the service-role client instead (see logAuditEvent's `client`
  // option). logAuditEvent never throws, so a failure here cannot lose the
  // acceptance record already saved above.
  await logAuditEvent({
    performedBy: user.email ?? merchant.fullName,
    actionType: 'accept_merchant_terms',
    module: 'merchant_terms_acceptances',
    recordId: inserted.id,
    newValue: {
      merchant_id: merchant.merchantId,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      accepted_by_name: merchant.fullName,
      acknowledgements,
    },
    client: createServiceClient(),
  });

  revalidatePath('/merchant/onboarding/terms');

  return { success: true, message: 'Thank you — your acceptance has been recorded.' };
}
