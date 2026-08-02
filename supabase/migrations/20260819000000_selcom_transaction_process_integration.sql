-- Wires the Selcom Business sandbox Transaction Process API
-- (POST /v1/transaction/process) into the existing Merchant Payouts
-- module. merchant_payouts.payout_reference (already unique, already
-- generated via next_finance_number('PAY')) is reused as Selcom's transId
-- — no new reference scheme. idempotency_key (already unique, already
-- deterministic per settlement line) is unchanged and stays a SEPARATE
-- guarantee from transId, exactly as before.
--
-- Two substantial additions:
--   1. decrypt_beneficiary_destination_for_payout(): the first and ONLY
--      decrypt path anywhere in this codebase for a beneficiary
--      destination value. Tightly scoped: gated by payouts.submit (the
--      exact permission needed to actually call Selcom), re-checks
--      verification_status = 'verified' independently of the caller, and
--      is designed to be invoked exactly once, immediately before the
--      signed Selcom request, by src/app/admin/(protected)/payouts/
--      actions.ts's submitPayout() — never stored, logged, or returned
--      anywhere beyond that one call.
--   2. begin_merchant_payout_submission() gains the full pre-submission
--      checklist this integration requires: merchant active, KYC
--      confirmed, till active, beneficiary verified (already existed),
--      cooling period completed, transactions reconciled, settlement
--      batch still approved/not held, no merchant-level compliance hold,
--      no active settlement hold, and the beneficiary's institution code
--      is a recognised Selcom code (selcom_institution_codes). "Amount
--      greater than zero" is already a table CHECK constraint
--      (merchant_payouts.amount > 0) — nothing to add. "Sufficient
--      available balance" requires a live Selcom API call and is checked
--      in the TypeScript layer, immediately before submission, not here.
--      "Maker and approver are different users" is already enforced in
--      approve_merchant_payout() — a separate, earlier stage.

alter table merchant_payouts
  add column if not exists recipient_name text,
  add column if not exists purpose text,
  add column if not exists remarks text,
  -- Raw Selcom response envelope (success/error_code/message/data/result/
  -- resultcode per the documented shape) — safe to store whole: nothing in
  -- that envelope is a secret. Never the request, which would require
  -- redacting recipientAccount first; only ever the RESPONSE.
  add column if not exists initial_response jsonb,
  add column if not exists selcom_receipt text;

-- ── decrypt_beneficiary_destination_for_payout() ────────────────────────
create or replace function decrypt_beneficiary_destination_for_payout(
  p_beneficiary_id uuid,
  p_encryption_key text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_encrypted bytea;
  v_status text;
begin
  if not has_permission('payouts.submit') then
    raise exception 'Missing required permission: payouts.submit';
  end if;

  select encrypted_destination_value, verification_status into v_encrypted, v_status
  from merchant_settlement_beneficiaries
  where id = p_beneficiary_id;

  if not found then
    raise exception 'Beneficiary not found';
  end if;
  if v_encrypted is null then
    raise exception 'No destination value on file for this beneficiary';
  end if;
  if v_status <> 'verified' then
    raise exception 'This beneficiary is not currently verified';
  end if;

  return pgp_sym_decrypt(v_encrypted, p_encryption_key);
end;
$$;

revoke execute on function decrypt_beneficiary_destination_for_payout(uuid, text) from public;
grant execute on function decrypt_beneficiary_destination_for_payout(uuid, text) to authenticated;
revoke execute on function decrypt_beneficiary_destination_for_payout(uuid, text) from anon;

-- ── begin_merchant_payout_submission(): full pre-submission checklist ──
create or replace function begin_merchant_payout_submission(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_beneficiary record;
  v_merchant record;
  v_batch record;
  v_performer text;
begin
  if not has_permission('payouts.submit') then
    raise exception 'Missing required permission: payouts.submit';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');
  perform check_merchant_payout_rate_limit(v_performer, 'submitted');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'approved' then
    raise exception 'Only an approved payout can be submitted';
  end if;

  -- Beneficiary: verified, cooling period passed, institution code
  -- recognised.
  if v_payout.beneficiary_id is null then
    raise exception 'This payout has no beneficiary on file and cannot be submitted';
  end if;
  select * into v_beneficiary from merchant_settlement_beneficiaries where id = v_payout.beneficiary_id;
  if v_beneficiary.verification_status <> 'verified' then
    raise exception 'This payout''s beneficiary is not currently verified and cannot be submitted';
  end if;
  if v_beneficiary.cooling_period_ends_at is not null and v_beneficiary.cooling_period_ends_at > now() then
    raise exception 'This payout''s beneficiary is still within its post-change cooling period';
  end if;
  if v_beneficiary.bank_or_network_code is null or not exists (
    select 1 from selcom_institution_codes where code = v_beneficiary.bank_or_network_code and is_active
  ) then
    raise exception 'This payout''s beneficiary institution code is not a recognised Selcom institution code';
  end if;

  -- Merchant: active, KYC confirmed, till active, no compliance hold.
  select * into v_merchant from merchants where id = v_payout.merchant_id;
  if v_merchant.status <> 'active' then
    raise exception 'Merchant is not active and cannot be paid out to';
  end if;
  if v_merchant.compliance_hold then
    raise exception 'Merchant is under compliance hold';
  end if;
  if not exists (
    select 1 from merchant_kyc_reviews where merchant_id = v_payout.merchant_id and partner_decision = 'approved'
  ) then
    raise exception 'Merchant KYC is not confirmed';
  end if;
  if not exists (
    select 1 from merchant_tills where merchant_id = v_payout.merchant_id and status = 'active'
  ) then
    raise exception 'Merchant has no active till';
  end if;

  -- No active settlement/chargeback hold for this merchant.
  if exists (
    select 1 from settlement_holds where merchant_id = v_payout.merchant_id and status = 'active'
  ) then
    raise exception 'Merchant has an active settlement hold';
  end if;

  -- Settlement batch: still approved-or-later, not compliance-held,
  -- not cancelled/failed.
  select * into v_batch from settlement_batches where id = v_payout.batch_id;
  if v_batch.compliance_hold then
    raise exception 'Settlement batch is on compliance hold';
  end if;
  if v_batch.status in ('cancelled', 'failed') then
    raise exception 'Settlement batch is % and cannot be paid out from', v_batch.status;
  end if;

  -- Underlying collection transactions for this merchant's line in this
  -- batch must still be reconciled. Transactions are immutably pinned to
  -- a batch only once matched (see block_settlement_batch_reassignment())
  -- and this app has no "un-match" path — this is a live re-check, not
  -- just a structural assumption.
  if exists (
    select 1 from collection_transactions
    where settlement_batch_id = v_payout.batch_id
      and merchant_id = v_payout.merchant_id
      and reconciliation_status <> 'matched'
  ) then
    raise exception 'One or more of this merchant''s transactions in the batch are not reconciled';
  end if;

  update merchant_payouts set status = 'submitted', submitted_at = now() where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by)
  values (p_payout_id, 'submitted', v_performer);
end;
$$;

revoke execute on function begin_merchant_payout_submission(uuid) from public;
grant execute on function begin_merchant_payout_submission(uuid) to authenticated;
revoke execute on function begin_merchant_payout_submission(uuid) from anon;

-- ── apply_merchant_payout_result(): gains optional trailing params to
-- record what requirement 13 asks for (recipient name, purpose, remarks,
-- the raw response envelope, and Selcom's receipt) in the same call that
-- already records status/provider reference — never a second, separate
-- write that could drift out of sync.
--
-- IMPORTANT correctness note: adding parameters changes a function's
-- signature, so `create or replace function` does NOT replace the old
-- 5-argument version — Postgres treats a changed argument list as a
-- distinct overload and would silently leave the old one in place
-- alongside the new one. The old signature is dropped explicitly first so
-- exactly one version of this function ever exists. This migration also
-- retroactively fixes the same mistake made in the previous migration
-- (20260818000000) for request_merchant_beneficiary_change, which added
-- p_lookup_id without dropping the old 13-argument overload first — see
-- below.
drop function if exists apply_merchant_payout_result(uuid, text, text, text, text);

create or replace function apply_merchant_payout_result(
  p_payout_id uuid,
  p_status text,
  p_provider_payout_reference text,
  p_failure_code text,
  p_failure_reason text,
  p_recipient_name text default null,
  p_purpose text default null,
  p_remarks text default null,
  p_initial_response jsonb default null,
  p_selcom_receipt text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
begin
  if not has_permission('payouts.submit') then
    raise exception 'Missing required permission: payouts.submit';
  end if;
  if p_status not in ('processing', 'successful', 'failed') then
    raise exception 'Invalid payout result status: %', p_status;
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status not in ('submitted', 'processing') then
    raise exception 'Only a submitted or processing payout can have its result applied';
  end if;

  update merchant_payouts set
    status = p_status,
    provider_payout_reference = coalesce(p_provider_payout_reference, provider_payout_reference),
    failure_code = case when p_status = 'failed' then p_failure_code else failure_code end,
    failure_reason = case when p_status = 'failed' then p_failure_reason else failure_reason end,
    completed_at = case when p_status in ('successful', 'failed') then now() else completed_at end,
    recipient_name = coalesce(p_recipient_name, recipient_name),
    purpose = coalesce(p_purpose, purpose),
    remarks = coalesce(p_remarks, remarks),
    initial_response = coalesce(p_initial_response, initial_response),
    selcom_receipt = coalesce(p_selcom_receipt, selcom_receipt)
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'result_' || p_status, v_performer, p_failure_reason);
end;
$$;

revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) to authenticated;
revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from anon;

-- ── Retroactive fix: 20260818000000 added p_lookup_id to
-- request_merchant_beneficiary_change via create-or-replace without
-- dropping the old 13-argument signature first, leaving both overloads
-- live. Drop the stale one — the 14-argument version (already granted to
-- authenticated, revoked from anon in that migration) is the only one any
-- caller has used since, since every call site passes p_lookup_id by
-- name. ───────────────────────────────────────────────────────────────
drop function if exists request_merchant_beneficiary_change(
  uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text
);
