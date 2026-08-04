-- ============================================================================
-- PROPOSED MIGRATION — FOR REVIEW ONLY. NOT APPLIED. DO NOT RUN WITHOUT
-- EXPLICIT APPROVAL.
--
-- BizLink Africa now operates a merchant-managed settlement model: every
-- merchant holds and manages their own payment account/wallet/till and
-- settles directly with their approved payment partner. BizLink Africa
-- does not receive, hold, control, reconcile, disburse or settle merchant
-- funds. This migration locks down the database objects that modeled the
-- retired payment-facilitator model accordingly.
--
-- What this migration does NOT do:
--   - Does not DROP any table, column, function, or trigger.
--   - Does not DELETE or UPDATE any existing business/financial column on
--     any historical row (amounts, statuses, references, timestamps,
--     beneficiary/merchant identifiers are all left exactly as they are).
--   - Does not touch any Selcom credential, API key, or private key value.
--   - Does not expose any additional beneficiary destination data — the
--     already-masked/encrypted columns stay masked/encrypted; RLS is only
--     ever narrowed here, never widened, for beneficiary data.
--
-- The only two categories of change:
--   1. ADDITIVE metadata: two new nullable columns (archived_at,
--      archived_reason) on the primary archived-entity tables, backfilled
--      on existing rows with a fixed annotation. This is new metadata, not
--      a change to any existing business column — see the header comment
--      of Section 1 for why this reading of "do not alter existing rows"
--      was used.
--   2. PRIVILEGE removal: REVOKE of write access and function EXECUTE
--      rights that are no longer needed now that every corresponding
--      application code path is permanently blocked at the server-action
--      layer. Removing an unused privilege cannot itself destroy data.
--
-- Section 3 (read-access tightening) includes a genuine judgment call —
-- CFO currently holds several of the permissions these SELECT policies
-- check, so tightening to Super-Admin-only means CFO loses read access to
-- this historical data. Two variants are provided; only one is active by
-- default (commented). Pick before applying — see Section 3's own header.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — Archive metadata (archived_at, archived_reason)
-- ============================================================================
-- Applied to the 15 primary entity tables (not their child/event/line-item
-- tables — those are already scoped by their parent's id and don't need a
-- redundant copy of the same two columns). New rows are not expected —
-- every code path that would create one is now permanently blocked — but
-- the columns are left nullable rather than NOT NULL so this migration
-- never has to guess a value for a hypothetical future insert path.

alter table collection_transactions            add column if not exists archived_at timestamptz;
alter table collection_transactions            add column if not exists archived_reason text;
alter table collection_reconciliation_runs     add column if not exists archived_at timestamptz;
alter table collection_reconciliation_runs     add column if not exists archived_reason text;
alter table collection_manual_adjustments      add column if not exists archived_at timestamptz;
alter table collection_manual_adjustments      add column if not exists archived_reason text;
alter table collection_import_batches          add column if not exists archived_at timestamptz;
alter table collection_import_batches          add column if not exists archived_reason text;
alter table commission_fee_rules               add column if not exists archived_at timestamptz;
alter table commission_fee_rules               add column if not exists archived_reason text;
alter table settlement_batches                 add column if not exists archived_at timestamptz;
alter table settlement_batches                 add column if not exists archived_reason text;
alter table merchant_payouts                   add column if not exists archived_at timestamptz;
alter table merchant_payouts                   add column if not exists archived_reason text;
alter table chargeback_cases                   add column if not exists archived_at timestamptz;
alter table chargeback_cases                   add column if not exists archived_reason text;
alter table settlement_holds                   add column if not exists archived_at timestamptz;
alter table settlement_holds                   add column if not exists archived_reason text;
alter table manual_reversal_requests           add column if not exists archived_at timestamptz;
alter table manual_reversal_requests           add column if not exists archived_reason text;
alter table selcom_integration_settings        add column if not exists archived_at timestamptz;
alter table selcom_integration_settings        add column if not exists archived_reason text;
alter table selcom_balance_snapshot            add column if not exists archived_at timestamptz;
alter table selcom_balance_snapshot            add column if not exists archived_reason text;
alter table selcom_production_readiness_checks add column if not exists archived_at timestamptz;
alter table selcom_production_readiness_checks add column if not exists archived_reason text;
alter table merchant_settlement_beneficiaries  add column if not exists archived_at timestamptz;
alter table merchant_settlement_beneficiaries  add column if not exists archived_reason text;
alter table merchant_beneficiary_change_requests add column if not exists archived_at timestamptz;
alter table merchant_beneficiary_change_requests add column if not exists archived_reason text;

-- Backfill existing rows. This sets ONLY the two new columns above — no
-- other column on any of these rows is touched by this statement.
do $$
declare
  v_reason text := 'Merchant-managed settlement model: BizLink Africa does not receive, hold, reconcile, disburse or settle merchant funds. Archived read-only for audit history.';
begin
  update collection_transactions            set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update collection_reconciliation_runs     set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update collection_manual_adjustments      set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update collection_import_batches          set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update commission_fee_rules               set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update settlement_batches                 set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update merchant_payouts                   set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update chargeback_cases                   set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update settlement_holds                   set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update manual_reversal_requests           set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update selcom_integration_settings        set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update selcom_balance_snapshot            set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update selcom_production_readiness_checks set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update merchant_settlement_beneficiaries  set archived_at = now(), archived_reason = v_reason where archived_at is null;
  update merchant_beneficiary_change_requests set archived_at = now(), archived_reason = v_reason where archived_at is null;
end $$;


-- ============================================================================
-- SECTION 2 — Remove INSERT/UPDATE/DELETE access from normal application
-- roles (RLS write policies)
-- ============================================================================
-- Every one of these tables' write paths already goes exclusively through
-- SECURITY DEFINER functions, EXCEPT the 8 policies below, which currently
-- grant direct table-level INSERT/UPDATE (bypassing those functions
-- entirely) to any authenticated user holding the named permission. Since
-- every corresponding server action is now permanently blocked at the app
-- layer, these RLS write policies are the one remaining way a
-- direct-to-Supabase request (bypassing the Next.js app) could still write
-- to archived financial tables. Dropping a policy removes a privilege; it
-- does not touch any existing row.

drop policy if exists "Staff can insert import batches with permission" on collection_import_batches;
drop policy if exists "Staff can request manual adjustments with permission" on collection_manual_adjustments;
drop policy if exists "Staff can review manual adjustments with approve permission" on collection_manual_adjustments;
drop policy if exists "Staff can insert reconciliation runs with permission" on collection_reconciliation_runs;
drop policy if exists "Staff can update reconciliation runs with approve permission" on collection_reconciliation_runs;
drop policy if exists "Staff can insert collection transactions with permission" on collection_transactions;
drop policy if exists "Staff can update collection transactions with reconcile permiss" on collection_transactions;
drop policy if exists "Staff can manage commission fee rule tiers with permission" on commission_fee_rule_tiers;
drop policy if exists "Staff can insert draft commission fee rules with permission" on commission_fee_rules;
drop policy if exists "Staff can edit draft commission fee rules with permission" on commission_fee_rules;
drop policy if exists "Staff can manage chargeback evidence with permission" on chargeback_evidence_items;

-- Note: "Merchant can view own transactions" (collection_transactions) and
-- "Merchant can view own payouts" (merchant_payouts) are SELECT-only
-- policies for merchant_users viewing their own historical data — left
-- untouched. They grant no write access and only ever return rows scoped
-- to the merchant's own id.


-- ============================================================================
-- SECTION 3 — Read-access tightening: Super Admin (/Auditor) only
-- ============================================================================
-- JUDGMENT CALL — READ BEFORE APPLYING. The existing SELECT policies on
-- these tables gate on has_permission('X.view'), and CFO currently holds
-- several of those (settlement.view, payouts.view, commission_rules.view,
-- collections.view, disbursement_balance.view, holds.view,
-- merchant_beneficiaries.view, chargebacks.view, reversals.view,
-- selcom_production.view, integrations.selcom.view — grants were not
-- changed by this migration). Replacing those policies with a strict
-- Super-Admin-only check means CFO loses read access to this archived
-- historical data. No "Auditor" role currently exists in role_permissions
-- — only 8 system roles are seeded (super_admin, ceo, cfo, cto, operations,
-- customer_support, marketing, compliance_security).
--
-- Two variants below; the strict one is active, the CFO-inclusive one is
-- commented out. Swap before applying if CFO should retain read access to
-- this historical data (e.g. for year-end accounting/audit purposes) —
-- that reading of "Auditor" would arguably already justify keeping CFO.

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_profiles sp
    where sp.user_id = auth.uid() and sp.is_active = true and sp.role = 'super_admin'
  );
$$;

-- Uncomment instead of is_super_admin() below if CFO should keep read
-- access to this archived data:
-- create or replace function is_super_admin_or_cfo() returns boolean
-- language sql stable security definer set search_path = public as $$
--   select exists (
--     select 1 from staff_profiles sp
--     where sp.user_id = auth.uid() and sp.is_active = true and sp.role in ('super_admin', 'cfo')
--   );
-- $$;

-- collection_transactions (merchant's own-row SELECT policy untouched)
drop policy if exists "Staff can view collection transactions with permission" on collection_transactions;
create policy "Super Admin can view archived collection transactions" on collection_transactions
  for select to authenticated using (is_super_admin());

-- collection_reconciliation_runs
drop policy if exists "Staff can view reconciliation runs with permission" on collection_reconciliation_runs;
create policy "Super Admin can view archived reconciliation runs" on collection_reconciliation_runs
  for select to authenticated using (is_super_admin());

-- collection_manual_adjustments
drop policy if exists "Staff can view manual adjustments with permission" on collection_manual_adjustments;
create policy "Super Admin can view archived manual adjustments" on collection_manual_adjustments
  for select to authenticated using (is_super_admin());

-- collection_import_batches
drop policy if exists "Staff can view import batches with permission" on collection_import_batches;
create policy "Super Admin can view archived import batches" on collection_import_batches
  for select to authenticated using (is_super_admin());

-- commission_fee_rules / commission_fee_rule_tiers
drop policy if exists "Staff can view commission fee rules with permission" on commission_fee_rules;
create policy "Super Admin can view archived commission fee rules" on commission_fee_rules
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view commission fee rule tiers with permission" on commission_fee_rule_tiers;
create policy "Super Admin can view archived commission fee rule tiers" on commission_fee_rule_tiers
  for select to authenticated using (is_super_admin());

-- settlement_batches / lines / exclusions / events
drop policy if exists "Staff can view settlement batches with permission" on settlement_batches;
create policy "Super Admin can view archived settlement batches" on settlement_batches
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view settlement batch lines with permission" on settlement_batch_lines;
create policy "Super Admin can view archived settlement batch lines" on settlement_batch_lines
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view settlement batch exclusions with permission" on settlement_batch_exclusions;
create policy "Super Admin can view archived settlement batch exclusions" on settlement_batch_exclusions
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view settlement batch events with permission" on settlement_batch_events;
create policy "Super Admin can view archived settlement batch events" on settlement_batch_events
  for select to authenticated using (is_super_admin());

-- merchant_payouts / events / status_checks (merchant's own-row and
-- integration-troubleshooting SELECT policies untouched — see Section 5 note)
drop policy if exists "Staff can view merchant payouts with permission" on merchant_payouts;
create policy "Super Admin can view archived merchant payouts" on merchant_payouts
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view merchant payout events with permission" on merchant_payout_events;
create policy "Super Admin can view archived merchant payout events" on merchant_payout_events
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view payout status checks with permission" on merchant_payout_status_checks;
create policy "Super Admin can view archived payout status checks" on merchant_payout_status_checks
  for select to authenticated using (is_super_admin());
-- "Integration staff can view payout status checks for troubleshooting"
-- (integrations.view) is left untouched — that's the preserved
-- technical-visibility policy backing /admin/integration-health/transactions.

-- chargeback_cases / case_events / evidence_items
drop policy if exists "Staff can view chargeback cases with permission" on chargeback_cases;
create policy "Super Admin can view archived chargeback cases" on chargeback_cases
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view chargeback case events with permission" on chargeback_case_events;
create policy "Super Admin can view archived chargeback case events" on chargeback_case_events
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view chargeback evidence with permission" on chargeback_evidence_items;
create policy "Super Admin can view archived chargeback evidence" on chargeback_evidence_items
  for select to authenticated using (is_super_admin());

-- settlement_holds / hold_events
drop policy if exists "Staff can view settlement holds with permission" on settlement_holds;
create policy "Super Admin can view archived settlement holds" on settlement_holds
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view settlement hold events with permission" on settlement_hold_events;
create policy "Super Admin can view archived settlement hold events" on settlement_hold_events
  for select to authenticated using (is_super_admin());

-- manual_reversal_requests
drop policy if exists "Staff can view manual reversal requests with permission" on manual_reversal_requests;
create policy "Super Admin can view archived manual reversal requests" on manual_reversal_requests
  for select to authenticated using (is_super_admin());

-- selcom_integration_settings / production_readiness_checks
drop policy if exists "Staff can view Selcom integration settings with permission" on selcom_integration_settings;
create policy "Super Admin can view archived Selcom integration settings" on selcom_integration_settings
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view the production readiness checklist with permissi" on selcom_production_readiness_checks;
create policy "Super Admin can view archived production readiness checklist" on selcom_production_readiness_checks
  for select to authenticated using (is_super_admin());

-- selcom_balance_snapshot / checks / reservations — BizLink's own retired
-- disbursement-account balance, not merchant transaction data
drop policy if exists "Finance can view the disbursement balance snapshot" on selcom_balance_snapshot;
create policy "Super Admin can view archived disbursement balance snapshot" on selcom_balance_snapshot
  for select to authenticated using (is_super_admin());
drop policy if exists "Finance can view balance check history" on selcom_balance_checks;
create policy "Super Admin can view archived disbursement balance checks" on selcom_balance_checks
  for select to authenticated using (is_super_admin());
drop policy if exists "Finance can view balance reservations" on selcom_balance_reservations;
create policy "Super Admin can view archived disbursement balance reservations" on selcom_balance_reservations
  for select to authenticated using (is_super_admin());

-- merchant_settlement_beneficiaries / change_requests / lookups — most
-- sensitive category (destination-account data); tightened to Super Admin
-- with no exception. Values remain masked/encrypted exactly as before —
-- this migration never widens what's visible, only who can see it.
drop policy if exists "Staff can view merchant settlement beneficiaries" on merchant_settlement_beneficiaries;
create policy "Super Admin can view archived settlement beneficiaries" on merchant_settlement_beneficiaries
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view beneficiary change requests with permission" on merchant_beneficiary_change_requests;
create policy "Super Admin can view archived beneficiary change requests" on merchant_beneficiary_change_requests
  for select to authenticated using (is_super_admin());
drop policy if exists "Staff can view Selcom beneficiary lookups with permission" on merchant_beneficiary_lookups;
create policy "Super Admin can view archived beneficiary lookups" on merchant_beneficiary_lookups
  for select to authenticated using (is_super_admin());


-- ============================================================================
-- SECTION 4 — Revoke EXECUTE on payout/settlement/disbursement/chargeback/
-- commission/reversal/beneficiary SECURITY DEFINER functions from
-- `authenticated`
-- ============================================================================
-- Every one of these functions is currently independently confirmed
-- executable by any signed-in user via Supabase's auto-generated
-- `/rest/v1/rpc/<function>` endpoint (each does have its own internal
-- has_permission(...) check, so a merchant or unprivileged staff member
-- cannot already succeed — but any staff member who legitimately holds the
-- checked permission, e.g. Super Admin or CFO, currently CAN still call
-- these directly, completely bypassing the app-layer archival guard added
-- to every corresponding Next.js server action). Supabase's own security
-- advisor independently flags each of these as "Signed-In Users Can
-- Execute SECURITY DEFINER Function" (lint: authenticated_security_
-- definer_function_executable). `anon` already has no grant on any of
-- these (confirmed live). `service_role` grants are left untouched — it
-- requires the service-role secret, never exposed to any client, and may
-- still be useful for one-off administrative/audit scripting.

revoke execute on function apply_collection_manual_adjustment(uuid, text) from authenticated;
revoke execute on function approve_collection_reconciliation_run(uuid, text) from authenticated;
revoke execute on function reject_collection_manual_adjustment(uuid, text) from authenticated;
revoke execute on function run_collection_reconciliation(date, date, text, uuid, numeric, text) from authenticated;

revoke execute on function approve_commission_fee_rule(uuid, text) from authenticated;
revoke execute on function reject_commission_fee_rule(uuid, text) from authenticated;
revoke execute on function expire_commission_fee_rule(uuid, date, text) from authenticated;
revoke execute on function submit_commission_fee_rule_for_approval(uuid) from authenticated;
revoke execute on function validate_commission_fee_rule_tiers(uuid) from authenticated;

revoke execute on function prepare_settlement_batch(date, uuid) from authenticated;
revoke execute on function submit_settlement_batch_for_review(uuid, text) from authenticated;
revoke execute on function review_settlement_batch(uuid, text) from authenticated;
revoke execute on function reject_settlement_batch(uuid, text) from authenticated;
revoke execute on function approve_settlement_batch(uuid, text, numeric) from authenticated;
revoke execute on function place_settlement_batch_hold(uuid, text) from authenticated;
revoke execute on function release_settlement_batch_hold(uuid, text) from authenticated;
revoke execute on function emergency_cancel_settlement_batch(uuid, text) from authenticated;
revoke execute on function begin_settlement_batch_processing(uuid) from authenticated;
revoke execute on function apply_settlement_line_payout_result(uuid, text, text, text) from authenticated;

revoke execute on function create_merchant_payouts_for_batch(uuid, text) from authenticated;
revoke execute on function approve_merchant_payout(uuid) from authenticated;
revoke execute on function cancel_merchant_payout(uuid, text) from authenticated;
revoke execute on function begin_merchant_payout_submission(uuid) from authenticated;
revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from authenticated;
revoke execute on function retry_merchant_payout(uuid) from authenticated;
revoke execute on function reverse_merchant_payout(uuid, text) from authenticated;
revoke execute on function place_merchant_payout_hold(uuid, text) from authenticated;
revoke execute on function release_merchant_payout_hold(uuid, text) from authenticated;
revoke execute on function decrypt_beneficiary_destination_for_payout(uuid, text) from authenticated;
revoke execute on function check_merchant_payout_rate_limit(text, text, integer) from authenticated;

revoke execute on function place_settlement_hold(uuid, uuid, uuid, text, numeric, timestamptz) from authenticated;
revoke execute on function request_settlement_hold_release(uuid, text) from authenticated;
revoke execute on function approve_settlement_hold_release(uuid, text) from authenticated;
revoke execute on function reject_settlement_hold_release(uuid, text) from authenticated;

revoke execute on function open_chargeback_case(uuid, numeric, numeric, text, timestamptz) from authenticated;
revoke execute on function request_chargeback_evidence(uuid, timestamptz) from authenticated;
revoke execute on function submit_chargeback_evidence(uuid) from authenticated;
revoke execute on function begin_chargeback_review(uuid) from authenticated;
revoke execute on function resolve_chargeback_case(uuid, text, text) from authenticated;
revoke execute on function close_chargeback_case(uuid, text) from authenticated;
revoke execute on function record_chargeback_recovery(uuid, numeric, text, text) from authenticated;

revoke execute on function request_manual_reversal(uuid, numeric, text, uuid) from authenticated;
revoke execute on function approve_manual_reversal(uuid, text) from authenticated;
revoke execute on function reject_manual_reversal(uuid, text) from authenticated;

revoke execute on function request_merchant_beneficiary_change(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text, uuid) from authenticated;
revoke execute on function approve_merchant_beneficiary_change_request(uuid, text, integer) from authenticated;
revoke execute on function reject_merchant_beneficiary_change_request(uuid, text) from authenticated;
revoke execute on function record_merchant_beneficiary_lookup(text, uuid, uuid, text, text, text, jsonb, numeric, text, text) from authenticated;
revoke execute on function confirm_beneficiary_lookup_name_match(uuid, boolean, text) from authenticated;
revoke execute on function generate_selcom_lookup_reference() from authenticated;

revoke execute on function set_selcom_integration_enabled(boolean) from authenticated;
revoke execute on function request_selcom_production_activation(text) from authenticated;
revoke execute on function authorize_selcom_production_activation(text, text) from authenticated;
revoke execute on function deauthorize_selcom_production_activation(text, text) from authenticated;
revoke execute on function record_selcom_production_finance_approval(boolean, text, text) from authenticated;
revoke execute on function record_selcom_production_compliance_approval(boolean, text, text) from authenticated;
revoke execute on function set_selcom_production_readiness_check(text, text, text, text) from authenticated;
revoke execute on function sync_selcom_configuration_snapshot(text, text, text, boolean) from authenticated;
revoke execute on function reserve_selcom_balance_for_batch(uuid, numeric, text) from authenticated;
revoke execute on function release_selcom_balance_reservation(uuid, text, text) from authenticated;
revoke execute on function record_selcom_balance_check(boolean, numeric, boolean, text, text, text, uuid, text) from authenticated;

revoke execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) from authenticated;
-- service_role keeps EXECUTE — the public callback route
-- (src/app/api/integrations/selcom/callback/[secret]/route.ts) uses a
-- service-role client, never the caller's own session, so this revoke
-- does not break inbound callback receipt.


-- ============================================================================
-- SECTION 5 — Deliberately NOT revoked / NOT touched (preserved
-- non-financial technical visibility)
-- ============================================================================
-- apply_payout_status_check_result, record_payout_status_check,
-- expire_payout_status_check — back the explicitly preserved read-only
-- "Check Status" action (checkPayoutProviderStatus in
-- src/app/admin/(protected)/payouts/actions.ts, deliberately NOT gated by
-- the app-layer archival guard). These update a payout's STATUS only, from
-- Selcom's own query response — they never create a payout, never move
-- money, and are the mechanism by which any payout still mid-flight from
-- before this change resolves to a final state for the audit record.
--
-- v_payout_integration_status (view) and its two supporting RLS policies
-- ("Integration staff can view payouts for troubleshooting" /
-- "...payout status checks for troubleshooting", both gated on
-- integrations.view) — already scoped to technical-only columns (no
-- amount, no beneficiary), added specifically to support
-- /admin/integration-health/transactions. Left untouched.
--
-- "Merchant can view own transactions" (collection_transactions) and
-- "Merchant can view own payouts" (merchant_payouts) — merchant_users
-- viewing their own historical data. Left untouched.
--
-- selcom_callback_events — recommend REPURPOSING rather than restricting:
-- its current policy ("Staff can view selcom callback events with
-- permission", gated on payouts.view) is financially-framed even though
-- the table itself is a technical inbound-callback log. Proposed:
--
-- create policy "Integration staff can view callback events for troubleshooting"
--   on selcom_callback_events for select to authenticated
--   using (has_permission('integrations.view'));
--
-- ...added ALONGSIDE the existing payouts.view policy (RLS policies are
-- OR'd), so this only ever adds read access for technical staff — it does
-- not remove Super Admin/CFO's existing visibility. Not applied here;
-- included for the same review-and-approve step as everything else in
-- this file.
