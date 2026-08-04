'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { hasRecentReauth } from '@/lib/supabase/reauth';
import { logAuditEvent } from '@/lib/audit';
import { maskCredential } from '@/lib/security/mask';
import { lookupRecipientAccount } from '@/lib/selcom/account-lookup';
import { isSelcomError } from '@/lib/selcom/errors';
import { isValidMoneyString } from '@/lib/collections/money';
import { assertArchivedFinancialPrototypeReadOnly } from '@/lib/archived-financial-prototype';

const REAUTH_REQUIRED_MESSAGE = 'Please re-authenticate to continue — this action requires a recent password confirmation.';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface AccountLookupInput {
  merchantId: string;
  beneficiaryId?: string;
  institutionCode: string;
  account: string;
  amount?: string;
}

export interface AccountLookupResult {
  success: boolean;
  message?: string;
  lookupId?: string;
  maskedAccount?: string;
  returnedAccountName?: string | null;
  totalCharges?: number | null;
}

// The only path from the browser to Selcom's account-lookup endpoint.
// `input.account` is the ONE raw account/wallet number this action ever
// touches — it goes straight into the signed Selcom request and into
// maskCredential() for storage, and is never itself written to a table,
// a log line, or this action's own return value.
export async function lookupBeneficiaryAccount(input: AccountLookupInput): Promise<AccountLookupResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('merchant_beneficiaries.manage');
  } catch {
    return { success: false, message: 'You do not have permission to look up settlement accounts.' };
  }
  if (!(await hasRecentReauth())) {
    return { success: false, message: REAUTH_REQUIRED_MESSAGE };
  }

  if (!isNonEmptyString(input.institutionCode)) {
    return { success: false, message: 'An institution is required.' };
  }
  if (!isNonEmptyString(input.account)) {
    return { success: false, message: 'An account or wallet number is required.' };
  }
  if (input.amount !== undefined && input.amount !== '' && !isValidMoneyString(input.amount)) {
    return { success: false, message: 'Amount must be a valid decimal value.' };
  }

  const account = input.account.trim();
  const maskedAccount = maskCredential(account);
  const supabase = await createClient();

  // Generated first — required as Selcom's transId in the outgoing
  // request itself, so it has to exist before that call is made.
  const { data: lookupReference, error: refError } = await supabase.rpc('generate_selcom_lookup_reference');
  if (refError || !lookupReference) {
    console.error('Failed to generate a Selcom lookup reference', refError);
    return { success: false, message: 'Failed to generate a lookup reference.' };
  }

  let returnedAccountName: string | null = null;
  let charges: unknown = null;
  let totalCharges: number | null = null;
  let status: 'success' | 'failed' = 'success';
  let failureReason: string | null = null;

  try {
    const result = await lookupRecipientAccount({
      bank: input.institutionCode,
      account,
      transId: lookupReference as string,
      amount: input.amount || undefined,
    });
    returnedAccountName = result.data.accountName ?? null;
    charges = result.data.charges ?? null;
    totalCharges = typeof result.data.totalCharges === 'number' ? result.data.totalCharges : null;
  } catch (err) {
    status = 'failed';
    failureReason = isSelcomError(err) ? err.message : 'Account lookup failed.';
  }

  const { data: recordedId, error: recordError } = await supabase.rpc('record_merchant_beneficiary_lookup', {
    p_lookup_reference: lookupReference,
    p_merchant_id: input.merchantId,
    p_beneficiary_id: input.beneficiaryId ?? null,
    p_institution_code: input.institutionCode,
    p_masked_account: maskedAccount,
    p_returned_account_name: returnedAccountName,
    p_charges: charges,
    p_total_charges: totalCharges,
    p_status: status,
    p_failure_reason: failureReason,
  });

  if (recordError || !recordedId) {
    console.error('Failed to record beneficiary account lookup', recordError);
    return { success: false, message: 'The lookup ran but could not be recorded. Contact an administrator.' };
  }

  // Never the raw account — masked value and non-sensitive fields only.
  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'account_lookup',
    module: 'merchant_beneficiary_lookups',
    recordId: recordedId as string,
    result: status === 'success' ? 'success' : 'failure',
    newValue: { institutionCode: input.institutionCode, maskedAccount, returnedAccountName, totalCharges },
    reason: failureReason ?? undefined,
  });

  revalidatePath(`/admin/merchant-operations/beneficiaries/${input.merchantId}`);

  if (status === 'failed') {
    return { success: false, message: failureReason ?? 'Account lookup failed.', lookupId: recordedId as string, maskedAccount };
  }

  return {
    success: true,
    lookupId: recordedId as string,
    maskedAccount,
    returnedAccountName,
    totalCharges,
  };
}

// Requirement: the returned name is never trusted on its own — a human
// must explicitly say whether it matches the merchant/authorised
// beneficiary before the lookup can support anything else (e.g. a 'verify'
// change request).
export async function confirmLookupNameMatch(
  lookupId: string,
  confirmed: boolean,
  notes: string,
  merchantId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  try {
    await requirePermission('merchant_beneficiaries.manage');
  } catch {
    return { success: false, message: 'You do not have permission to review account lookups.' };
  }
  if (!(await hasRecentReauth())) {
    return { success: false, message: REAUTH_REQUIRED_MESSAGE };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_beneficiary_lookup_name_match', {
    p_lookup_id: lookupId,
    p_confirmed: confirmed,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    console.error('Failed to confirm lookup name match', lookupId, error);
    return { success: false, message: error.message ?? 'Failed to record the review.' };
  }

  revalidatePath(`/admin/merchant-operations/beneficiaries/${merchantId}`);
  return { success: true };
}
