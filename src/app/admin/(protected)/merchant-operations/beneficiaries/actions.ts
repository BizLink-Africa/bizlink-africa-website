'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { hasRecentReauth } from '@/lib/supabase/reauth';
import { logAuditEvent } from '@/lib/audit';
import { maskCredential } from '@/lib/security/mask';
import { sendEmail } from '@/lib/email/resend';
import { assertArchivedFinancialPrototypeReadOnly } from '@/lib/archived-financial-prototype';

const REAUTH_REQUIRED_MESSAGE = 'Please re-authenticate to continue — this action requires a recent password confirmation.';
const COOLING_PERIOD_HOURS = 48;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface BeneficiaryChangeRequestInput {
  merchantId: string;
  beneficiaryId?: string;
  requestType: 'add' | 'change' | 'verify' | 'suspend';
  destinationType?: string;
  accountHolderName?: string;
  bankOrNetworkName?: string;
  bankOrNetworkCode?: string;
  destinationValue?: string;
  verificationMethod?: string;
  isPrimary?: boolean;
  changeReason: string;
  // Links a 'verify' proposal to the account-lookup evidence that supports
  // it (see lookup-actions.ts) — purely for traceability, never a
  // shortcut around the maker-checker approval this request still
  // requires.
  lookupId?: string;
}

// The only write path for a beneficiary proposal. The raw destination
// value passes through this one function call and into the
// request_merchant_beneficiary_change() RPC (which encrypts it
// server-side, inside Postgres, via pgcrypto) — it is never written to a
// log, never returned to the caller, and this action's own return value
// never echoes it back either.
export async function requestBeneficiaryChange(input: BeneficiaryChangeRequestInput): Promise<{ success: boolean; message?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('merchant_beneficiaries.manage');
  } catch {
    return { success: false, message: 'You do not have permission to propose settlement beneficiary changes.' };
  }

  if (!(await hasRecentReauth())) {
    return { success: false, message: REAUTH_REQUIRED_MESSAGE };
  }

  if (!isNonEmptyString(input.changeReason)) {
    return { success: false, message: 'A reason is required.' };
  }
  if ((input.requestType === 'add' || input.requestType === 'change') && !isNonEmptyString(input.destinationValue)) {
    return { success: false, message: 'A destination value is required.' };
  }
  if ((input.requestType === 'change' || input.requestType === 'verify' || input.requestType === 'suspend') && !input.beneficiaryId) {
    return { success: false, message: 'A beneficiary must be selected.' };
  }

  const encryptionKey = process.env.BENEFICIARY_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('BENEFICIARY_ENCRYPTION_KEY is not configured');
    return { success: false, message: 'Beneficiary storage is not configured. Contact an administrator.' };
  }

  const destinationValue = input.destinationValue?.trim() || null;
  const maskedValue = destinationValue ? maskCredential(destinationValue) : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc('request_merchant_beneficiary_change', {
    p_merchant_id: input.merchantId,
    p_beneficiary_id: input.beneficiaryId ?? null,
    p_request_type: input.requestType,
    p_destination_type: input.destinationType ?? null,
    p_account_holder_name: input.accountHolderName?.trim() || null,
    p_bank_or_network_name: input.bankOrNetworkName?.trim() || null,
    p_bank_or_network_code: input.bankOrNetworkCode?.trim() || null,
    p_destination_value: destinationValue,
    p_masked_value: maskedValue,
    p_verification_method: input.verificationMethod ?? null,
    p_is_primary: input.isPrimary ?? null,
    p_change_reason: input.changeReason.trim().slice(0, 500),
    p_encryption_key: encryptionKey,
    p_lookup_id: input.lookupId ?? null,
  });

  if (error) {
    console.error('Failed to propose beneficiary change', input.merchantId, error);
    return { success: false, message: 'Failed to submit the request.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `propose_${input.requestType}`,
    module: 'merchant_beneficiary_change_requests',
    recordId: input.merchantId,
    // Only the masked value and non-sensitive fields — never the raw
    // destination value.
    newValue: { requestType: input.requestType, maskedValue, changeReason: input.changeReason },
  });

  revalidatePath('/admin/merchant-operations/beneficiaries');
  revalidatePath(`/admin/merchant-operations/beneficiaries/${input.merchantId}`);
  return { success: true };
}

async function sendBeneficiaryChangeAlert(merchantId: string, requestType: string, actor: string) {
  const supabase = await createClient();
  const [{ data: merchant }, { data: settings }] = await Promise.all([
    supabase.from('merchants').select('business_name').eq('id', merchantId).maybeSingle(),
    supabase.from('company_settings').select('compliance_alert_email').maybeSingle(),
  ]);

  const to = settings?.compliance_alert_email;
  if (!to) return;

  await sendEmail({
    to,
    subject: `Settlement beneficiary ${requestType} approved — ${merchant?.business_name ?? 'Unknown merchant'}`,
    html: `<p>A settlement beneficiary <strong>${requestType}</strong> request for <strong>${merchant?.business_name ?? 'Unknown merchant'}</strong> was approved by ${actor}.</p><p>No account details are included in this notification.</p>`,
    text: `A settlement beneficiary ${requestType} request for ${merchant?.business_name ?? 'Unknown merchant'} was approved by ${actor}. No account details are included in this notification.`,
  });
}

export async function approveBeneficiaryChangeRequest(
  requestId: string,
  merchantId: string,
  requestType: string,
  reviewNotes?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('merchant_beneficiaries.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve settlement beneficiary changes.' };
  }

  if (!(await hasRecentReauth())) {
    return { success: false, message: REAUTH_REQUIRED_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('approve_merchant_beneficiary_change_request', {
      p_request_id: requestId,
      p_review_notes: reviewNotes?.trim() || null,
      p_cooling_period_hours: COOLING_PERIOD_HOURS,
    })
    .select()
    .single<{ beneficiary_id: string; old_masked_value: string | null; new_masked_value: string | null }>();

  if (error || !data) {
    console.error('Failed to approve beneficiary change request', requestId, error);
    // The RPC itself raises a friendly-enough message for the maker-checker
    // and already-reviewed cases — surface it rather than a generic one.
    return { success: false, message: error?.message ?? 'Failed to approve the request.' };
  }

  // Old/new values recorded here are already masked (that's what the RPC
  // returns) — never the encrypted or raw value.
  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `approve_${requestType}`,
    module: 'merchant_beneficiary_change_requests',
    recordId: merchantId,
    oldValue: { maskedValue: data.old_masked_value },
    newValue: { maskedValue: data.new_masked_value, coolingPeriodHours: COOLING_PERIOD_HOURS },
  });

  await sendBeneficiaryChangeAlert(merchantId, requestType, user.email ?? 'unknown');

  revalidatePath('/admin/merchant-operations/beneficiaries');
  revalidatePath(`/admin/merchant-operations/beneficiaries/${merchantId}`);
  return { success: true };
}

export async function rejectBeneficiaryChangeRequest(
  requestId: string,
  merchantId: string,
  reviewNotes: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('merchant_beneficiaries.approve');
  } catch {
    return { success: false, message: 'You do not have permission to reject settlement beneficiary changes.' };
  }

  if (!(await hasRecentReauth())) {
    return { success: false, message: REAUTH_REQUIRED_MESSAGE };
  }

  if (!isNonEmptyString(reviewNotes)) {
    return { success: false, message: 'A reason is required to reject a request.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_merchant_beneficiary_change_request', {
    p_request_id: requestId,
    p_review_notes: reviewNotes.trim().slice(0, 500),
  });

  if (error) {
    console.error('Failed to reject beneficiary change request', requestId, error);
    return { success: false, message: error.message ?? 'Failed to reject the request.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'reject_change_request',
    module: 'merchant_beneficiary_change_requests',
    recordId: merchantId,
    newValue: { reviewNotes },
  });

  revalidatePath('/admin/merchant-operations/beneficiaries');
  revalidatePath(`/admin/merchant-operations/beneficiaries/${merchantId}`);
  return { success: true };
}
