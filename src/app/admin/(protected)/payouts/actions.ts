'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { hasRecentReauth } from '@/lib/supabase/reauth';
import { PAYOUT_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import { SelcomDisbursementAdapter } from '@/lib/payouts/selcom-disbursement-adapter';
import { getAccountBalance } from '@/lib/selcom/balance';
import { queryTransactionStatus } from '@/lib/selcom/transaction-status';
import { isSelcomError } from '@/lib/selcom/errors';
import { mapSelcomTransactionStatus } from '@/lib/payouts/selcom-status-mapping';
import { checkPayoutStatus } from '@/lib/payouts/status-check-service';
import { resolveSelcomEnvironment } from '@/lib/selcom/config';
import { assertMerchantSettlementsNotBizLinkManaged } from '@/lib/archived-financial-prototype';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface ActionResult {
  success: boolean;
  message?: string;
  payoutId?: string;
  createdCount?: number;
}

// Every action below that touches Selcom checks this first — the
// Administration -> Integrations -> Disbursement API kill switch. When
// disabled, staff can still manage payouts locally (approve/cancel/hold)
// but nothing here is allowed to call Selcom at all.
async function assertSelcomIntegrationEnabled(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ActionResult> {
  const { data } = await supabase.from('selcom_integration_settings').select('integration_enabled').eq('id', true).maybeSingle();
  if (!data?.integration_enabled) {
    return { success: false, message: 'The Selcom integration is currently disabled. A Super Admin must enable it first.' };
  }
  return { success: true };
}

export async function createPayoutsForBatch(batchId: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.manage');
  } catch {
    return { success: false, message: 'You do not have permission to request payouts.' };
  }

  // Stamped once, at creation, and frozen from then on (see
  // block_immutable_merchant_payout_mutation()) — "never copy sandbox
  // payout records into production records". resolveSelcomEnvironment()
  // only resolves which environment is configured; it never requires full
  // Selcom credentials to be present, so payout creation is never blocked
  // by an unrelated Selcom configuration gap — but it can still throw on a
  // genuinely malformed SELCOM_ENV, so it's resolved before anything else
  // and reported the same way any other validation failure here is.
  let environment;
  try {
    environment = resolveSelcomEnvironment();
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Selcom environment is misconfigured.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_merchant_payouts_for_batch', {
    p_batch_id: batchId,
    p_environment: environment,
  });
  if (error) {
    console.error('Failed to create merchant payouts for batch', batchId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create_payouts',
    module: 'merchant_payouts',
    recordId: batchId,
    newValue: { createdCount: data },
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/settlement/${batchId}`);
  return { success: true, createdCount: data as number };
}

// Approving real money movement requires a fresh re-authentication —
// checked here, server-side, never trusted from client state.
export async function approvePayout(payoutId: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve payouts.' };
  }
  if (!(await hasRecentReauth(PAYOUT_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before approving a payout.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_merchant_payout', { p_payout_id: payoutId });
  if (error) {
    console.error('Failed to approve payout', payoutId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'approve',
    module: 'merchant_payouts',
    recordId: payoutId,
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, payoutId };
}

export async function cancelPayout(payoutId: string, reason: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.manage');
  } catch {
    return { success: false, message: 'You do not have permission to cancel payouts.' };
  }
  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required to cancel a payout.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_merchant_payout', { p_payout_id: payoutId, p_reason: reason.trim() });
  if (error) {
    console.error('Failed to cancel payout', payoutId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'cancel',
    module: 'merchant_payouts',
    recordId: payoutId,
    newValue: { reason },
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, payoutId };
}

// Submits an approved payout to Selcom's real SANDBOX Transaction Process
// API (POST /v1/transaction/process) — never production; see
// src/lib/selcom/config.ts's structural sandbox-only guard.
//
// Called exactly once per invocation of this action: there is no retry
// loop anywhere in this function. A retry is always a separate, later,
// human-triggered call to this SAME action (after retryPayout() has moved
// the payout back to 'approved') — see the retry_count > 0 branch below,
// which queries Selcom for the transId's existing status BEFORE ever
// resubmitting, so a retry can never produce a duplicate real
// disbursement even if a previous attempt's response was lost to a
// network timeout.
export async function submitPayout(payoutId: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.submit');
  } catch {
    return { success: false, message: 'You do not have permission to submit payouts.' };
  }
  if (!(await hasRecentReauth(PAYOUT_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before submitting a payout to the Selcom sandbox.' };
  }

  const supabase = await createClient();

  const enabledCheck = await assertSelcomIntegrationEnabled(supabase);
  if (!enabledCheck.success) return enabledCheck;

  const { data: payout, error: fetchError } = await supabase.from('merchant_payouts').select('*').eq('id', payoutId).maybeSingle();
  if (fetchError || !payout) {
    return { success: false, message: 'Payout not found.' };
  }
  if (!payout.beneficiary_id) {
    return { success: false, message: 'This payout has no beneficiary on file.' };
  }

  const { data: beneficiary, error: beneficiaryError } = await supabase
    .from('merchant_settlement_beneficiaries')
    .select('masked_destination_value, destination_type, account_holder_name, bank_or_network_code, verification_status')
    .eq('id', payout.beneficiary_id)
    .maybeSingle();
  if (beneficiaryError || !beneficiary) {
    return { success: false, message: 'Beneficiary not found.' };
  }

  const adapter = new SelcomDisbursementAdapter();

  const validation = await adapter.validateBeneficiary({
    destinationType: beneficiary.destination_type,
    maskedDestinationValue: beneficiary.masked_destination_value ?? '—',
  });
  if (!validation.valid) {
    return { success: false, message: validation.reason ?? 'Beneficiary failed validation.' };
  }

  // Sufficient available balance: the one item on the pre-submission
  // checklist that requires a live call and so cannot live in the
  // begin_merchant_payout_submission() database check alongside the rest.
  try {
    const balanceResult = await getAccountBalance();
    if (Number(balanceResult.data.availableBalance) < Number(payout.amount)) {
      return { success: false, message: 'Insufficient available balance in the Selcom disbursement account for this payout.' };
    }
  } catch (err) {
    const message = isSelcomError(err) ? err.message : 'Failed to check the Selcom disbursement account balance.';
    return { success: false, message };
  }

  // Controlled retry workflow (requirement: a retry must not produce a
  // duplicate payment). Only engages when this payout has already been
  // retried at least once — a first attempt has never been sent anywhere,
  // so there is nothing to check yet.
  if (payout.retry_count > 0 && payout.payout_reference) {
    try {
      const existing = await queryTransactionStatus({ transId: payout.payout_reference });
      const mappedExisting = mapSelcomTransactionStatus(existing.data.status);
      if (mappedExisting !== 'failed') {
        // Selcom already has a non-failed record for this transId — sync
        // our record to match instead of sending a second real request.
        const { error: beginError } = await supabase.rpc('begin_merchant_payout_submission', { p_payout_id: payoutId });
        if (beginError) return { success: false, message: beginError.message };

        const { error: syncError } = await supabase.rpc('apply_merchant_payout_result', {
          p_payout_id: payoutId,
          p_status: mappedExisting,
          p_provider_payout_reference: existing.data.selcomReceipt ?? null,
          p_failure_code: null,
          p_failure_reason: null,
          p_recipient_name: beneficiary.account_holder_name,
          p_purpose: 'FT',
          p_remarks: null,
          p_initial_response: { result: existing.result, resultCode: existing.resultCode, data: existing.data },
          p_selcom_receipt: existing.data.selcomReceipt ?? null,
        });
        if (syncError) return { success: false, message: syncError.message };

        await logAuditEvent({
          performedBy: user.email ?? 'unknown',
          actionType: 'submit',
          module: 'merchant_payouts',
          recordId: payoutId,
          newValue: { adapter: adapter.name, status: mappedExisting, note: 'Synced from an existing Selcom transId instead of resubmitting.' },
        });
        revalidatePath('/admin/payouts');
        revalidatePath(`/admin/payouts/${payoutId}`);
        return { success: true, payoutId };
      }
      // mappedExisting === 'failed': Selcom has explicitly rejected this
      // transId before — safe to proceed with a genuine new attempt below.
    } catch {
      // Status query failed — the expected outcome when Selcom has no
      // record of this transId at all (the common case for a request that
      // never actually reached them). Proceed with a fresh attempt.
    }
  }

  const { error: beginError } = await supabase.rpc('begin_merchant_payout_submission', { p_payout_id: payoutId });
  if (beginError) {
    console.error('Failed to begin payout submission', payoutId, beginError);
    return { success: false, message: beginError.message };
  }

  const encryptionKey = process.env.BENEFICIARY_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('BENEFICIARY_ENCRYPTION_KEY is not configured');
    return { success: false, message: 'Beneficiary storage is not configured. Contact an administrator.' };
  }

  // The ONE place in this codebase a raw beneficiary destination value
  // exists in application memory. Decrypted just-in-time, immediately
  // below, and handed straight into the signed Selcom request — never
  // assigned to any other variable, never logged, never included in this
  // action's return value.
  const { data: rawDestination, error: decryptError } = await supabase.rpc('decrypt_beneficiary_destination_for_payout', {
    p_beneficiary_id: payout.beneficiary_id,
    p_encryption_key: encryptionKey,
  });
  if (decryptError || !rawDestination) {
    console.error('Failed to resolve beneficiary destination for payout', payoutId, decryptError);
    return { success: false, message: 'Failed to resolve the beneficiary destination for this payout.' };
  }

  const result = await adapter.submitPayout({
    payoutId,
    payoutReference: payout.payout_reference,
    idempotencyKey: payout.idempotency_key,
    merchantId: payout.merchant_id,
    beneficiaryId: payout.beneficiary_id,
    destinationType: payout.destination_type,
    institutionCode: beneficiary.bank_or_network_code,
    recipientAccount: rawDestination as string,
    recipientName: beneficiary.account_holder_name,
    // Supabase's runtime response for a numeric column isn't guaranteed to
    // match the MerchantPayout TS type's `amount: string` — coerce
    // explicitly here rather than trust the type. This is a
    // representation change only (Postgres already computed the exact
    // value), never an arithmetic operation, so it doesn't reintroduce
    // floating-point calculation into the payout amount itself.
    amount: String(payout.amount),
    currency: payout.currency,
  });
  // rawDestination is not referenced again past this point.

  const { error: resultError } = await supabase.rpc('apply_merchant_payout_result', {
    p_payout_id: payoutId,
    p_status: result.status,
    p_provider_payout_reference: result.providerPayoutReference,
    p_failure_code: result.failureCode,
    p_failure_reason: result.failureReason,
    p_recipient_name: beneficiary.account_holder_name,
    p_purpose: 'FT',
    p_remarks: null,
    p_initial_response: result.rawResponse ?? null,
    p_selcom_receipt: result.providerPayoutReference,
  });
  if (resultError) {
    console.error('Failed to apply payout result', payoutId, resultError);
    return { success: false, message: resultError.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'submit',
    module: 'merchant_payouts',
    recordId: payoutId,
    // Never the raw destination value — status/reference only. result.status
    // is 'processing' for Selcom's documented ACCEPTED (async, not yet
    // finalized) and only 'successful' for the documented COMPLETED.
    newValue: { adapter: adapter.name, status: result.status, providerPayoutReference: result.providerPayoutReference },
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, payoutId };
}

// Controlled retry workflow, step 1 of 2: moves a failed payout back to
// 'approved' (max 3 retries, enforced in retry_merchant_payout()) so a
// human must separately click Submit again — see submitPayout() above for
// step 2, which checks Selcom for an existing record of this payout's
// transId before ever sending a second real request. Never automatic:
// nothing in this codebase calls submitPayout() on a timer or in response
// to a failure — only an explicit staff action.
export async function retryPayout(payoutId: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.manage');
  } catch {
    return { success: false, message: 'You do not have permission to retry payouts.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('retry_merchant_payout', { p_payout_id: payoutId });
  if (error) {
    console.error('Failed to retry payout', payoutId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'retry',
    module: 'merchant_payouts',
    recordId: payoutId,
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, payoutId };
}

export async function placePayoutHold(payoutId: string, reason: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.hold');
  } catch {
    return { success: false, message: 'You do not have permission to place a hold on payouts.' };
  }
  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required to place a hold.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('place_merchant_payout_hold', { p_payout_id: payoutId, p_reason: reason.trim() });
  if (error) {
    console.error('Failed to place payout hold', payoutId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'hold_placed',
    module: 'merchant_payouts',
    recordId: payoutId,
    newValue: { reason },
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, payoutId };
}

export async function releasePayoutHold(payoutId: string, notes: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.hold');
  } catch {
    return { success: false, message: 'You do not have permission to release a payout hold.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('release_merchant_payout_hold', { p_payout_id: payoutId, p_notes: notes?.trim() || null });
  if (error) {
    console.error('Failed to release payout hold', payoutId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'hold_released',
    module: 'merchant_payouts',
    recordId: payoutId,
    newValue: { notes },
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, payoutId };
}

export async function reversePayout(payoutId: string, reason: string): Promise<ActionResult> {
  try {
    await assertMerchantSettlementsNotBizLinkManaged();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('payouts.approve');
  } catch {
    return { success: false, message: 'You do not have permission to reverse a payout.' };
  }
  if (!isNonEmptyString(reason)) {
    return { success: false, message: 'A reason is required to reverse a payout.' };
  }
  if (!(await hasRecentReauth(PAYOUT_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before reversing a payout.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('reverse_merchant_payout', { p_payout_id: payoutId, p_reason: reason.trim() });
  if (error) {
    console.error('Failed to reverse payout', payoutId, error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'reverse',
    module: 'merchant_payouts',
    recordId: payoutId,
    newValue: { reason },
  });

  revalidatePath('/admin/payouts');
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, payoutId };
}

// Manually checks Selcom's status for a payout already submitted. Routes
// through the same central status-check-service.ts used by the scheduled
// cron poller — one code path, so "store every attempt" and "update
// status only using validated documented statuses" hold identically for
// both manual and automatic checks. Every manual check is audit-logged,
// whether or not it changes anything (requirement: audit each manual
// status query).
// Read-only technical status check — never moves money, never touches the
// disbursement pipeline. Deliberately NOT gated by
// assertMerchantSettlementsNotBizLinkManaged(): transaction-status viewing
// is explicitly preserved non-financial integration support, distinct from
// the payout-creation/approval/submission/retry/cancellation/hold/reversal
// actions above, all of which move or control money and are permanently
// blocked.
export async function checkPayoutProviderStatus(payoutId: string): Promise<ActionResult & { providerStatus?: string }> {
  let user;
  try {
    user = await requirePermission('payouts.view');
  } catch {
    return { success: false, message: 'You do not have permission to view payouts.' };
  }

  const supabase = await createClient();
  const { data: payout } = await supabase
    .from('merchant_payouts')
    .select('id, payout_reference, status_check_count')
    .eq('id', payoutId)
    .maybeSingle();
  if (!payout) {
    return { success: false, message: 'Payout not found.' };
  }
  if (!payout.payout_reference) {
    return { success: false, message: 'This payout has not been submitted to Selcom yet.' };
  }

  const performedBy = user.email ?? 'unknown';
  const outcome = await checkPayoutStatus(supabase, payout, { triggerType: 'manual', performedBy });

  await logAuditEvent({
    performedBy,
    actionType: 'status_check',
    module: 'merchant_payouts',
    recordId: payoutId,
    result: outcome.querySucceeded ? 'success' : 'failure',
    newValue: {
      externalStatus: outcome.externalStatus,
      mappedStatus: outcome.mappedStatus,
      applied: outcome.applied,
      skipReason: outcome.skipReason,
    },
    reason: outcome.errorMessage ?? undefined,
  });

  if (!outcome.querySucceeded) {
    // The CHECK failing (e.g. Selcom's sandbox 404ing a transId for a
    // short window right after accepting it — confirmed live) is never
    // evidence the transaction itself failed. Report the problem without
    // touching the payout's recorded status at all.
    return { success: false, message: outcome.errorMessage ?? 'Failed to check status with Selcom.' };
  }

  if (outcome.applied) {
    revalidatePath('/admin/payouts');
    revalidatePath(`/admin/payouts/${payoutId}`);
  }

  return { success: true, payoutId, providerStatus: outcome.mappedStatus ?? undefined };
}
