import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { queryTransactionStatus } from '@/lib/selcom/transaction-status';
import { SelcomApiError, isSelcomError } from '@/lib/selcom/errors';
import { mapSelcomTransactionStatus, getBackoffMinutes, type MappedPayoutStatus } from './selcom-status-mapping';

// The ONE place this app ever calls Selcom's Transaction Query endpoint to
// resolve a payout's status. Both the manual "Check Status" action
// (src/app/admin/(protected)/payouts/actions.ts) and the scheduled cron
// route (src/app/api/payouts/status-check-cron/route.ts) call this same
// function — never a separate, divergent code path — so "store every
// status-query attempt" and "update status only using validated
// documented statuses" are guaranteed to hold everywhere, not just for
// whichever caller happened to be written most recently.
//
// Never creates a new disbursement: this only ever performs a GET
// /v1/transaction/query and records/applies its result. Concurrency
// safety (row locking, the terminal-state guard, and the
// query-start-time monotonic guard against out-of-order responses) all
// live in apply_payout_status_check_result() in the database — this
// function's job is just to call Selcom once, then hand the raw result to
// that guarded function and to record_payout_status_check() for the
// unconditional attempt log.

type StatusCheckSupabaseClient = Pick<Awaited<ReturnType<typeof createClient>>, 'rpc'>;

export interface PayoutForStatusCheck {
  id: string;
  payout_reference: string;
  status_check_count: number;
}

export interface StatusCheckOutcome {
  querySucceeded: boolean;
  externalStatus: string | null;
  mappedStatus: MappedPayoutStatus | null;
  selcomReceipt: string | null;
  applied: boolean;
  skipReason: string | null;
  errorMessage: string | null;
}

export async function checkPayoutStatus(
  supabase: StatusCheckSupabaseClient,
  payout: PayoutForStatusCheck,
  options: { triggerType: 'manual' | 'scheduled'; performedBy: string }
): Promise<StatusCheckOutcome> {
  const startedAt = new Date();
  // Always the payout's own transId — never Selcom's own receipt. See
  // src/lib/payouts/selcom-status-mapping.ts's header note: confirmed
  // live that Selcom's query endpoint only recognises the transId
  // originally supplied on the process request.
  const transId = payout.payout_reference;

  let querySucceeded = false;
  let httpStatus: number | null = null;
  let result: string | null = null;
  let resultCode: string | null = null;
  let externalStatus: string | null = null;
  let mappedStatus: MappedPayoutStatus | null = null;
  let selcomReceipt: string | null = null;
  let rawResponse: Record<string, unknown> | null = null;
  let errorMessage: string | null = null;

  try {
    const queryResult = await queryTransactionStatus({ transId });
    querySucceeded = true;
    httpStatus = 200;
    result = queryResult.result;
    resultCode = queryResult.resultCode;
    externalStatus = queryResult.data.status ?? null;
    selcomReceipt = queryResult.data.selcomReceipt || null;
    mappedStatus = mapSelcomTransactionStatus(externalStatus);
    rawResponse = { result: queryResult.result, resultCode: queryResult.resultCode, data: queryResult.data };
  } catch (err) {
    // A query FAILURE (network error, 404, timeout, malformed response)
    // is never evidence the transaction itself failed — see the
    // live-confirmed bug this exact distinction fixed in
    // src/lib/payouts/selcom-disbursement-adapter.ts's getPayoutStatus().
    // Record the failure; never derive a mapped status from it, and never
    // call apply_payout_status_check_result at all in this branch.
    if (err instanceof SelcomApiError) httpStatus = err.httpStatus;
    errorMessage = isSelcomError(err) ? err.message : 'Selcom status query failed.';
  }

  let applied = false;
  let skipReason: string | null = null;

  if (querySucceeded && mappedStatus) {
    const backoffMinutes = getBackoffMinutes(payout.status_check_count + 1);
    const { data: applyRows, error: applyError } = await supabase.rpc('apply_payout_status_check_result', {
      p_payout_id: payout.id,
      p_query_started_at: startedAt.toISOString(),
      p_mapped_status: mappedStatus,
      p_external_status: externalStatus,
      p_provider_payout_reference: selcomReceipt,
      p_selcom_receipt: selcomReceipt,
      p_failure_code: mappedStatus === 'failed' ? 'SELCOM_REPORTED_FAILED' : null,
      p_failure_reason: mappedStatus === 'failed' ? `Selcom reported status: ${externalStatus}` : null,
      p_backoff_minutes: backoffMinutes,
      p_performed_by: options.performedBy,
    });
    if (applyError) {
      errorMessage = applyError.message;
    } else if (applyRows && applyRows.length > 0) {
      applied = Boolean(applyRows[0].applied);
      skipReason = applyRows[0].skip_reason ?? null;
    }
  }

  // Unconditional — every attempt is recorded, whether the query
  // succeeded, whether a mapped status resulted, and whether it was
  // actually applied or skipped by a guard.
  await supabase.rpc('record_payout_status_check', {
    p_payout_id: payout.id,
    p_trans_id: transId,
    p_trigger_type: options.triggerType,
    p_performed_by: options.performedBy,
    p_started_at: startedAt.toISOString(),
    p_query_succeeded: querySucceeded,
    p_http_status: httpStatus,
    p_result: result,
    p_resultcode: resultCode,
    p_external_status: externalStatus,
    p_mapped_status: mappedStatus,
    p_status_applied: applied,
    p_skip_reason: skipReason,
    p_error_message: errorMessage,
    p_raw_response: rawResponse,
  });

  return { querySucceeded, externalStatus, mappedStatus, selcomReceipt, applied, skipReason, errorMessage };
}
