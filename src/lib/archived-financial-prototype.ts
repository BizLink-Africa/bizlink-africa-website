import 'server-only';
import { getStaffProfile } from '@/lib/supabase/dal';

// The settlement/payout/collection/commission/financial-reports apparatus was
// built for a payment-facilitator model BizLink Africa does not operate under.
// BizLink Africa does not receive, hold, reconcile, disburse or settle
// merchant funds — merchants settle directly with their approved payment
// partner. This module's pages and data are preserved read-only for audit
// history, gated to Super Admin only, and never reachable from active
// navigation or production operations.
//
// Defaults to enabled (true) so the archive remains viewable by Super Admin
// immediately after deploy — flip ARCHIVED_FINANCIAL_PROTOTYPE_ENABLED=false
// to block viewing entirely (records are never deleted either way).
export function isArchivedFinancialPrototypeEnabled(): boolean {
  const raw = process.env.ARCHIVED_FINANCIAL_PROTOTYPE_ENABLED;
  if (raw === undefined) return true;
  return raw.trim().toLowerCase() !== 'false';
}

export const ARCHIVED_PROTOTYPE_BANNER_TEXT =
  'Archived prototype — BizLink Africa does not handle merchant funds or settlements.';

// Layout-level gate for every archived route: must be Super Admin AND the
// flag must be enabled. Returns a short reason string on failure so the
// caller can render the appropriate denial state; returns null on success.
export async function checkArchivedFinancialPrototypeAccess(): Promise<
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'not_super_admin' | 'unauthenticated' }
> {
  if (!isArchivedFinancialPrototypeEnabled()) {
    return { ok: false, reason: 'disabled' };
  }
  const staff = await getStaffProfile();
  if (!staff || !staff.is_active) {
    return { ok: false, reason: 'unauthenticated' };
  }
  if (staff.role !== 'super_admin') {
    return { ok: false, reason: 'not_super_admin' };
  }
  return { ok: true };
}

// Absolute mutation guard for every server action in an archived module —
// intentionally independent of the flag/role check above. Whether or not the
// archive is currently viewable, nothing in it may ever write again. Always
// throws; callers should let it propagate (server actions already run inside
// a try/catch that turns thrown errors into a user-facing failure message).
export async function assertArchivedFinancialPrototypeReadOnly(): Promise<never> {
  throw new Error(
    'This module is archived and permanently read-only. BizLink Africa does not handle merchant funds or settlements.'
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Merchant-managed settlement model — central flag
// ═══════════════════════════════════════════════════════════════════════
//
// The confirmed operating model: every merchant holds and manages their own
// payment account/wallet/till and settles directly with their approved
// payment partner. BizLink Africa provides ICT infrastructure, onboarding
// coordination, integrations and technical support only — it never
// receives, holds, controls, disburses or settles merchant funds.
//
// BIZLINK_MANAGES_MERCHANT_SETTLEMENTS is the single, explicit, testable
// statement of that fact — defaults to (and must remain) false. Every
// payout-creation, payout-approval, payout-retry, payout-cancellation,
// payout-balance-reservation, settlement-batch-creation, settlement-batch-
// approval, and disbursement code path is gated by
// assertMerchantSettlementsNotBizLinkManaged() below.
//
// That guard does NOT branch on the flag's value — it always blocks. This
// is deliberate: BizLink not managing merchant settlement is a confirmed
// business-model decision, not a feature toggle, so a single stray
// environment variable must never be able to single-handedly restore real
// fund movement. Restoring this functionality requires a deliberate code
// change, not just flipping BIZLINK_MANAGES_MERCHANT_SETTLEMENTS=true. The
// flag exists so the intended state is explicit, checked, and tested
// (see archived-financial-prototype.test.ts), not just implied by absence.
export function isBizlinkManagingMerchantSettlements(): boolean {
  const raw = process.env.BIZLINK_MANAGES_MERCHANT_SETTLEMENTS;
  return (raw ?? '').trim().toLowerCase() === 'true';
}

export const MERCHANT_PAYOUTS_NOT_HANDLED_MESSAGE =
  'Merchant payouts are not handled by BizLink Africa. Settlement is managed directly by each merchant through the approved payment partner.';

// The central, server-side gate for every payout/settlement/disbursement
// action (payout creation, approval, submission, retry, cancellation,
// holds, balance reservation, settlement-batch creation/approval, and the
// actual disbursement call). Always throws — see the module comment above
// for why this is unconditional rather than an `if (isBizlinkManaging...)`
// branch.
export async function assertMerchantSettlementsNotBizLinkManaged(): Promise<never> {
  throw new Error(MERCHANT_PAYOUTS_NOT_HANDLED_MESSAGE);
}
