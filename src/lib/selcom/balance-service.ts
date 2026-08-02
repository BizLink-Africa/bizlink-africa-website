import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { getAccountBalance } from './balance';
import { isSelcomError } from './errors';
import { maskCredential } from '@/lib/security/mask';

// Everything the Super Admin / Finance "Disbursement Balance" dashboard
// needs, built on top of the existing getAccountBalance() (POST
// /v1/balance) call. This module is the only place that ever reads the
// raw Selcom balance response outside of balance.ts itself — the account
// number is masked here, immediately, before anything is returned to a
// caller that might render it.

type BalanceRpcClient = Pick<Awaited<ReturnType<typeof createClient>>, 'rpc'>;
type BalanceQueryClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

export interface RefreshBalanceOutcome {
  querySucceeded: boolean;
  maskedAccountNumber: string | null;
  availableBalance: number | null;
  accountActive: boolean | null;
  currency: string | null;
  errorMessage: string | null;
}

// The ONE place this app calls Selcom's Balance API and records the
// result — used by both the manual "Refresh Balance" action and the
// settlement batch approval flow, so "do not treat the displayed balance
// as accounting truth without reconciliation" and "never expose the raw
// response in the frontend" hold everywhere this integration touches
// balance, not just wherever was written most recently.
export async function refreshSelcomBalance(
  supabase: BalanceRpcClient,
  options: { triggerType: 'manual' | 'batch_approval'; batchId: string | null; performedBy: string }
): Promise<RefreshBalanceOutcome> {
  let querySucceeded = false;
  let availableBalance: number | null = null;
  let accountActive: boolean | null = null;
  let currency: string | null = null;
  let maskedAccountNumber: string | null = null;
  let errorMessage: string | null = null;

  try {
    const result = await getAccountBalance();
    querySucceeded = true;
    availableBalance = result.data.availableBalance;
    accountActive = result.data.active;
    currency = result.data.currency;
    // Selcom echoes the account number back in the response — masked
    // immediately, never passed on raw beyond this point.
    maskedAccountNumber = maskCredential(result.data.accountNumber);
  } catch (err) {
    errorMessage = isSelcomError(err) ? err.message : 'Selcom balance check failed.';
  }

  await supabase.rpc('record_selcom_balance_check', {
    p_query_succeeded: querySucceeded,
    p_available_balance: availableBalance,
    p_account_active: accountActive,
    p_currency: currency,
    p_error_message: errorMessage,
    p_trigger_type: options.triggerType,
    p_batch_id: options.batchId,
    p_performed_by: options.performedBy,
  });

  return { querySucceeded, maskedAccountNumber, availableBalance, accountActive, currency, errorMessage };
}

export interface DisbursementBalanceSnapshot {
  available_balance: string | null;
  account_active: boolean | null;
  currency: string | null;
  checked_at: string | null;
  checked_by: string | null;
  low_balance_threshold: string;
}

export interface DisbursementBalanceCheck {
  id: string;
  checked_at: string;
  checked_by: string;
  trigger_type: 'manual' | 'batch_approval';
  query_succeeded: boolean;
  available_balance: string | null;
  account_active: boolean | null;
  currency: string | null;
  error_message: string | null;
  batch_id: string | null;
}

export interface DisbursementBalanceReservation {
  id: string;
  batch_id: string;
  reserved_amount: string;
  status: 'active' | 'released' | 'consumed';
  reserved_at: string;
  released_at: string | null;
}

export interface DisbursementBalanceDashboard {
  snapshot: DisbursementBalanceSnapshot | null;
  pendingApprovedPayoutsTotal: number;
  reservedTotal: number;
  projectedBalance: number | null;
  lowBalance: boolean;
  insufficientBalance: boolean;
  history: DisbursementBalanceCheck[];
  reservations: DisbursementBalanceReservation[];
}

// Supabase/PostgREST can return a numeric column as a JS number rather
// than a string depending on how it was written — coerce explicitly at
// this boundary rather than assuming, same lesson already learned
// elsewhere in this integration (see selcom-status-mapping.ts's sibling
// files).
function toNumber(value: string | number | null): number {
  if (value === null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

// Server-side only: fetches everything the dashboard needs and computes
// the two derived figures itself (never trusts a client-computed
// projection). "Pending approved payouts" = merchant_payouts already
// approved but not yet submitted/resolved — money this app has committed
// to paying but Selcom doesn't know about yet. "Reserved" is the
// balance-reservation ledger (already-approved BATCHES, which is a
// coarser, earlier commitment than individual payout approval — see the
// migration's header comment for why both figures exist and aren't the
// same number).
export async function getDisbursementBalanceDashboard(supabase: BalanceQueryClient): Promise<DisbursementBalanceDashboard> {
  const [{ data: snapshot }, { data: pendingRows }, { data: reservations }, { data: history }] = await Promise.all([
    supabase.from('selcom_balance_snapshot').select('*').eq('id', true).maybeSingle(),
    supabase.from('merchant_payouts').select('amount').eq('status', 'approved'),
    supabase.from('selcom_balance_reservations').select('*').order('reserved_at', { ascending: false }).limit(50),
    supabase.from('selcom_balance_checks').select('*').order('checked_at', { ascending: false }).limit(50),
  ]);

  const pendingApprovedPayoutsTotal = ((pendingRows ?? []) as Array<{ amount: string | number }>).reduce(
    (sum, row) => sum + toNumber(row.amount),
    0
  );
  const reservedTotal = ((reservations ?? []) as DisbursementBalanceReservation[])
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + toNumber(r.reserved_amount), 0);

  const typedSnapshot = (snapshot ?? null) as DisbursementBalanceSnapshot | null;
  const availableBalance = typedSnapshot?.available_balance != null ? toNumber(typedSnapshot.available_balance) : null;
  const projectedBalance = availableBalance !== null ? availableBalance - reservedTotal : null;
  const lowBalanceThreshold = typedSnapshot ? toNumber(typedSnapshot.low_balance_threshold) : 0;

  return {
    snapshot: typedSnapshot,
    pendingApprovedPayoutsTotal,
    reservedTotal,
    projectedBalance,
    lowBalance: projectedBalance !== null && projectedBalance >= 0 && projectedBalance < lowBalanceThreshold,
    insufficientBalance: projectedBalance !== null && projectedBalance < 0,
    history: (history ?? []) as DisbursementBalanceCheck[],
    reservations: (reservations ?? []) as DisbursementBalanceReservation[],
  };
}
