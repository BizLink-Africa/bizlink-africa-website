'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAuditEvent } from '@/lib/audit';
import { hasRecentReauth, SELCOM_INTEGRATION_REAUTH_PURPOSE, PAYOUT_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import { getAccountBalance } from '@/lib/selcom/balance';
import { getSelcomIntegrationStatus } from '@/lib/selcom/status';
import { isSelcomError } from '@/lib/selcom/errors';
import { processSelcomCallback, maskCallbackAccountNumber, getLiveCallbackTestUrl } from '@/lib/selcom/callback';
import { refreshSelcomBalance } from '@/lib/selcom/balance-service';
import { assertArchivedFinancialPrototypeReadOnly } from '@/lib/archived-financial-prototype';

const PAGE_PATH = '/admin/settings/integrations/selcom';

interface ActionResult {
  success: boolean;
  message?: string;
}

// Every test/balance action below refuses to run while the Super Admin
// kill switch (selcom_integration_settings.integration_enabled) is off —
// this is what makes the toggle a real gate, not just a display field.
async function assertIntegrationEnabled(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ActionResult> {
  const { data } = await supabase.from('selcom_integration_settings').select('integration_enabled').eq('id', true).maybeSingle();
  if (!data?.integration_enabled) {
    return { success: false, message: 'The Selcom integration is currently disabled. A Super Admin must enable it first.' };
  }
  return { success: true };
}

// Toggles the kill switch. Requires fresh re-authentication, checked here
// as defense in depth — page.tsx already gates the control itself behind
// the same reauth check, same belt-and-suspenders pattern as
// approvePayout() in src/app/admin/(protected)/payouts/actions.ts.
export async function setIntegrationEnabled(enabled: boolean): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('integrations.selcom.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change this setting.' };
  }
  if (!(await hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before changing this setting.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_selcom_integration_enabled', { p_enabled: enabled });
  if (error) {
    console.error('Failed to update Selcom integration enabled state', error);
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: enabled ? 'integration_enabled' : 'integration_disabled',
    module: 'selcom_integration',
  });

  revalidatePath(PAGE_PATH);
  return { success: true };
}

// Records a REQUEST only — never flips anything live. See config.ts and
// the migration's comment on request_selcom_production_activation().
export async function requestProductionActivation(reason: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('integrations.selcom.manage');
  } catch {
    return { success: false, message: 'You do not have permission to request production activation.' };
  }
  if (!(await hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before requesting production activation.' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, message: 'A reason is required to request production activation.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('request_selcom_production_activation', { p_reason: reason.trim() });
  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'production_activation_requested',
    module: 'selcom_integration',
    newValue: { reason: reason.trim() },
  });

  revalidatePath(PAGE_PATH);
  return {
    success: true,
    message: 'Production activation request recorded. This does not enable live payouts by itself — that requires a separate, deliberate code change.',
  };
}

// Exercises the one safe, documented, read-only Selcom endpoint (Balance)
// purely to confirm the configured credentials and signing are accepted —
// the returned balance figure itself is discarded here (see
// checkAccountBalance() below for the action that surfaces it). Never
// retried automatically beyond what src/lib/selcom/balance.ts already does
// for a single logical check (its own internal retry only covers
// network/timeout/503, not this whole action).
export async function testSandboxConnection(): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('integrations.selcom.test');
  } catch {
    return { success: false, message: 'You do not have permission to test the Selcom sandbox connection.' };
  }

  const supabase = await createClient();
  const enabledCheck = await assertIntegrationEnabled(supabase);
  if (!enabledCheck.success) return enabledCheck;

  const correlationId = randomUUID();
  try {
    await getAccountBalance(undefined, correlationId);
    await logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'connection_test',
      module: 'selcom_integration',
      result: 'success',
      correlationId,
    });
    revalidatePath(PAGE_PATH);
    return { success: true, message: 'Sandbox connection succeeded.' };
  } catch (err) {
    const message = isSelcomError(err) ? err.message : 'Sandbox connection failed.';
    await logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'connection_test',
      module: 'selcom_integration',
      result: 'failure',
      reason: message,
      correlationId,
    });
    revalidatePath(PAGE_PATH);
    return { success: false, message };
  }
}

// Same underlying call as testSandboxConnection() — Selcom's docs don't
// document a separate lightweight "ping"/health endpoint, so the one safe
// read-only call (Balance) does double duty. What differs is intent and
// what's surfaced: this one is logged as 'balance_check' and returns the
// actual balance/currency for display, never just a pass/fail.
export async function checkAccountBalance(): Promise<ActionResult & { balance?: string; currency?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('integrations.selcom.balance');
  } catch {
    return { success: false, message: 'You do not have permission to check the Selcom account balance.' };
  }

  const supabase = await createClient();
  const enabledCheck = await assertIntegrationEnabled(supabase);
  if (!enabledCheck.success) return enabledCheck;

  const correlationId = randomUUID();
  try {
    const result = await getAccountBalance(undefined, correlationId);
    await logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'balance_check',
      module: 'selcom_integration',
      result: 'success',
      correlationId,
      // Currency only — never the account number, and this is the same
      // balance figure Finance already sees in Merchant Settlement
      // Reports, not a credential.
      newValue: { currency: result.data.currency },
    });
    revalidatePath(PAGE_PATH);
    return { success: true, balance: String(result.data.availableBalance), currency: result.data.currency };
  } catch (err) {
    const message = isSelcomError(err) ? err.message : 'Balance check failed.';
    await logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'balance_check',
      module: 'selcom_integration',
      result: 'failure',
      reason: message,
      correlationId,
    });
    revalidatePath(PAGE_PATH);
    return { success: false, message };
  }
}

// Local configuration-completeness check only (URL present + HTTPS, secret
// present) — Selcom's docs do not document any endpoint to ask "is my
// callback URL registered with you," so this deliberately never makes a
// network call and says so in its result message, rather than implying it
// confirmed anything with Selcom itself.
export async function verifyCallbackConfiguration(): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('integrations.selcom.test');
  } catch {
    return { success: false, message: 'You do not have permission to verify the Selcom callback configuration.' };
  }

  const status = getSelcomIntegrationStatus();
  const success = status.callbackConfigured;
  const message = success
    ? `Callback URL and secret are configured (host: ${status.callbackUrlHost ?? 'unknown'}). This checks local configuration only — it does not confirm Selcom has this URL registered.`
    : 'Callback URL and/or secret are missing, or the URL is not HTTPS.';

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    // Distinct from 'callback_configuration_change' (reserved for drift
    // actually detected in the env vars themselves, see sync.ts) — this is
    // a manually triggered check of the current configuration, not a
    // change.
    actionType: 'callback_configuration_check',
    module: 'selcom_integration',
    result: success ? 'success' : 'failure',
  });

  revalidatePath(PAGE_PATH);
  return { success, message };
}

export interface SimulateCallbackOptions {
  dryRun: boolean;
  // Deliberate negative-test toggles, so the Callback Testing panel can
  // demonstrate each guard in process_selcom_callback() actually rejects
  // bad input, not just that the happy path works.
  tamperAmount: boolean;
  tamperReference: boolean;
  tamperDestination: boolean;
}

// Exercises the real callback pipeline against a real sandbox payout —
// "callback testing page for sandbox". Two modes:
//   - dryRun (default, safe): calls process_selcom_callback() directly
//     with p_dry_run = true — runs every guard, never mutates the payout.
//   - live: sends an actual HTTP POST to this app's own live callback
//     route (the exact same code path Selcom itself would hit), so a
//     passing test really can mark the selected sandbox payout
//     'successful'. Requires fresh re-authentication, same as any other
//     action that finalises payout state (approvePayout/submitPayout).
//
// Never reconstructs a genuine raw destination account number — this app
// never decrypts merchant_settlement_beneficiaries.encrypted_destination_value
// (see the callback migration's header comment), so a "happy path"
// simulation omits recipient_account_number entirely (it's an optional
// callback field; process_selcom_callback() correctly skips the
// destination check when it's absent). tamperDestination sends a
// deliberately wrong value instead, to prove the guard rejects it.
export async function simulateSelcomCallback(
  payoutId: string,
  options: SimulateCallbackOptions
): Promise<ActionResult & { outcome?: string; rejectionReason?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('integrations.selcom.test');
  } catch {
    return { success: false, message: 'You do not have permission to test the Selcom callback endpoint.' };
  }

  const supabase = await createClient();
  const enabledCheck = await assertIntegrationEnabled(supabase);
  if (!enabledCheck.success) return enabledCheck;

  if (!options.dryRun && !(await hasRecentReauth(PAYOUT_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before sending a live callback simulation — it can mark a real sandbox payout as Successful.' };
  }

  // Service client for the payout lookup: integrations.selcom.test holders
  // (e.g. CTO) are not guaranteed to also hold payouts.view, and this is
  // the same trust boundary the real callback route itself already
  // operates in (a service-role client, gated by the permission check
  // just above rather than by payouts.view RLS).
  const serviceClient = createServiceClient();
  const { data: payout } = await serviceClient
    .from('merchant_payouts')
    .select('payout_reference, amount, status')
    .eq('id', payoutId)
    .maybeSingle();

  if (!payout) {
    return { success: false, message: 'Payout not found.' };
  }

  const referenceId = options.tamperReference ? `${payout.payout_reference}-TEST-INVALID` : payout.payout_reference;
  const amount = options.tamperAmount ? (Number(payout.amount) + 1).toFixed(2) : payout.amount;
  const recipientAccountNumber = options.tamperDestination ? '0000000000-TEST' : undefined;
  const selcomReceipt = `TEST-${randomUUID().slice(0, 8).toUpperCase()}`;

  let outcome: string;
  let rejectionReason: string | null;

  try {
    if (options.dryRun) {
      const result = await processSelcomCallback(serviceClient, {
        referenceId,
        rawStatus: 'SUCCESS',
        selcomReceipt,
        amount,
        maskedSenderAccountNumber: null,
        senderAccountName: null,
        maskedRecipientAccountNumber: maskCallbackAccountNumber(recipientAccountNumber),
        recipientName: recipientAccountNumber ? 'Test Recipient' : null,
        charges: null,
        sourceIp: null,
        performedBy: user.email ?? 'unknown',
        dryRun: true,
      });
      outcome = result.outcome;
      rejectionReason = result.rejectionReason;
    } else {
      const testUrl = getLiveCallbackTestUrl();
      if ('error' in testUrl) {
        return { success: false, message: testUrl.error };
      }
      const response = await fetch(testUrl.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reference_id: referenceId,
          status: 'SUCCESS',
          amount,
          selcom_receipt: selcomReceipt,
          ...(recipientAccountNumber ? { recipient_account_number: recipientAccountNumber, recipient_name: 'Test Recipient' } : {}),
        }),
      });
      if (!response.ok) {
        return { success: false, message: `Live callback simulation returned HTTP ${response.status}.` };
      }
      // The route's own response never includes the outcome (Selcom's docs
      // don't document an expected response shape, so nothing was invented
      // there) — read it back from the event this call just wrote instead.
      const { data: eventRow } = await serviceClient
        .from('selcom_callback_events')
        .select('outcome, rejection_reason')
        .eq('reference_id', referenceId)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      outcome = eventRow?.outcome ?? 'unknown';
      rejectionReason = eventRow?.rejection_reason ?? null;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Callback simulation failed.';
    await logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'callback_simulation',
      module: 'selcom_integration',
      recordId: payoutId,
      result: 'failure',
      reason: message,
      newValue: { dryRun: options.dryRun, referenceId },
    });
    return { success: false, message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'callback_simulation',
    module: 'selcom_integration',
    recordId: payoutId,
    result: outcome === 'processed' || outcome === 'dry_run_ok' ? 'success' : 'failure',
    newValue: { referenceId, outcome, ...options },
  });

  revalidatePath(PAGE_PATH);
  revalidatePath(`/admin/payouts/${payoutId}`);
  return { success: true, outcome, rejectionReason: rejectionReason ?? undefined };
}

// "Only Super Admin or authorised Finance Approver can refresh manually"
// — disbursement_balance.refresh (granted only to super_admin and
// finance_approver, see the migration) is a deliberately narrower gate
// than disbursement_balance.view (which also covers cfo/cto). Never
// returns the raw Selcom response — only the already-masked/typed fields
// refreshSelcomBalance() produces.
export async function refreshDisbursementBalance(): Promise<ActionResult & { maskedAccountNumber?: string }> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('disbursement_balance.refresh');
  } catch {
    return { success: false, message: 'You do not have permission to refresh the disbursement balance.' };
  }

  const supabase = await createClient();
  const enabledCheck = await assertIntegrationEnabled(supabase);
  if (!enabledCheck.success) return enabledCheck;

  const result = await refreshSelcomBalance(supabase, {
    triggerType: 'manual',
    batchId: null,
    performedBy: user.email ?? 'unknown',
  });

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'balance_refresh',
    module: 'selcom_integration',
    result: result.querySucceeded ? 'success' : 'failure',
    reason: result.errorMessage ?? undefined,
    // Masked account number and currency only — never the raw balance
    // response, never a full account number.
    newValue: { maskedAccountNumber: result.maskedAccountNumber, currency: result.currency },
  });

  revalidatePath(PAGE_PATH);

  if (!result.querySucceeded) {
    return { success: false, message: result.errorMessage ?? 'Failed to refresh the Selcom disbursement balance.' };
  }
  return { success: true, maskedAccountNumber: result.maskedAccountNumber ?? undefined };
}
