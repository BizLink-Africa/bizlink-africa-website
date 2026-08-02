-- Selcom Balance API integration for the Infinity Disbursement account
-- (POST /v1/balance, request field: account_number — see
-- src/lib/selcom/balance.ts, which already implements the call itself).
-- This migration adds the persistent side: a cached snapshot for display,
-- a balance-check audit history, and an internal reservation ledger that
-- prevents two settlement batches from both assuming the same available
-- Selcom funds.
--
-- Design summary:
--   1. selcom_balance_snapshot: ONE row, the last known balance — cached
--      for display only ("do not treat the displayed balance as
--      accounting truth without reconciliation" — it is explicitly a
--      cache of the last check, never re-derived or trusted as live
--      truth). This row is ALSO the lock target for every reservation
--      attempt below (see reserve_selcom_balance_for_batch()), which is
--      what makes "prevent two batches from reserving the same available
--      funds" true: only one transaction can hold this row's lock at a
--      time, so balance checks and reservations against it are globally
--      serialized.
--   2. selcom_balance_checks: append-only history of every balance check,
--      manual or triggered by a batch-approval attempt — "balance-check
--      audit history".
--   3. selcom_balance_reservations: one row per settlement batch that has
--      successfully reserved funds at approval time. reserve_selcom_
--      balance_for_batch() is the only function that ever inserts a row
--      here, and only after confirming (available balance - sum of other
--      active reservations) covers this batch's merchant_net_total.
--      maybe_release_batch_reservation() is the only function that ever
--      marks one 'consumed' — once every payout belonging to that batch
--      has reached a terminal status, the reserved amount is no longer a
--      pending future draw on the account (it's either already paid out
--      or the payout failed/was cancelled and never drew the balance at
--      all).
--   4. approve_settlement_batch() (20260811000000) gains a third
--      parameter (p_available_balance numeric) and now calls
--      reserve_selcom_balance_for_batch() before finalising approval —
--      "before batch approval, verify sufficient cleared available
--      balance". The signature change means the OLD 2-arg overload must
--      be explicitly dropped (CREATE OR REPLACE does not do this — see
--      this codebase's standing lesson on that pitfall), verified below.

-- ── Permissions: view is broader ("Finance roles"), refresh is narrower
-- ("Only Super Admin or authorised Finance Approver"). Deliberately
-- distinct from the existing integrations.selcom.balance (that one gates
-- the Sandbox Checks page's generic "does this endpoint work" diagnostic
-- for CTO; this is the Finance-facing balance dashboard). ─────────────────
insert into permissions (id, module, description) values
  ('disbursement_balance.view', 'finance', 'View the Selcom Infinity Disbursement account balance dashboard'),
  ('disbursement_balance.refresh', 'finance', 'Manually refresh the Selcom disbursement balance from Selcom')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id in ('disbursement_balance.view', 'disbursement_balance.refresh')
    and id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('cfo', 'disbursement_balance.view'),
  ('cto', 'disbursement_balance.view'),
  ('finance_approver', 'disbursement_balance.view'),
  ('finance_approver', 'disbursement_balance.refresh')
on conflict do nothing;

-- ── selcom_balance_snapshot: singleton cache + reservation lock target ──
create table if not exists selcom_balance_snapshot (
  id boolean primary key default true check (id),
  available_balance numeric(14, 2),
  account_active boolean,
  currency text,
  checked_at timestamp with time zone,
  checked_by text,
  -- Configurable thresholds for the low-balance / insufficient-balance
  -- dashboard alerts — policy values, not derived from anything Selcom
  -- returns.
  low_balance_threshold numeric(14, 2) not null default 5000000,
  created_at timestamp with time zone not null default now()
);
insert into selcom_balance_snapshot (id) values (true) on conflict (id) do nothing;

alter table selcom_balance_snapshot enable row level security;
create policy "Finance can view the disbursement balance snapshot"
  on selcom_balance_snapshot for select to authenticated
  using (has_permission('disbursement_balance.view'));
-- No insert/update policy — written only by record_selcom_balance_check()
-- below.

-- ── selcom_balance_checks: append-only history — "balance-check audit
-- history". ──────────────────────────────────────────────────────────────
create table if not exists selcom_balance_checks (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamp with time zone not null default now(),
  checked_by text not null,
  trigger_type text not null check (trigger_type in ('manual', 'batch_approval')),
  query_succeeded boolean not null,
  available_balance numeric(14, 2),
  account_active boolean,
  currency text,
  error_message text,
  -- Set only when trigger_type = 'batch_approval' — which batch's
  -- approval attempt prompted this check.
  batch_id uuid references settlement_batches(id)
);
alter table selcom_balance_checks enable row level security;
create index if not exists selcom_balance_checks_checked_at_idx on selcom_balance_checks (checked_at desc);

create policy "Finance can view balance check history"
  on selcom_balance_checks for select to authenticated
  using (has_permission('disbursement_balance.view'));
-- No insert/update policy — written only by record_selcom_balance_check().

-- ── selcom_balance_reservations: the internal ledger — "reserve approved
-- payout amounts internally to prevent over-allocation". ────────────────
create table if not exists selcom_balance_reservations (
  id uuid primary key default gen_random_uuid(),
  -- One reservation per batch, ever — re-approval attempts (e.g. a retried
  -- RPC call) must never double-reserve the same batch's amount.
  batch_id uuid not null references settlement_batches(id) unique,
  reserved_amount numeric(14, 2) not null check (reserved_amount > 0),
  status text not null default 'active' check (status in ('active', 'released', 'consumed')),
  reserved_at timestamp with time zone not null default now(),
  released_at timestamp with time zone,
  release_reason text,
  created_by text not null
);
alter table selcom_balance_reservations enable row level security;
create index if not exists selcom_balance_reservations_status_idx on selcom_balance_reservations (status);

create policy "Finance can view balance reservations"
  on selcom_balance_reservations for select to authenticated
  using (has_permission('disbursement_balance.view'));
-- No insert/update policy — written only by reserve_selcom_balance_for_batch(),
-- maybe_release_batch_reservation(), and release_selcom_balance_reservation()
-- below.

-- ── record_selcom_balance_check(): the only function that ever writes to
-- selcom_balance_checks or selcom_balance_snapshot. Called by the manual
-- Refresh action (trigger_type = 'manual') and, internally, at the start
-- of every settlement batch approval attempt (trigger_type =
-- 'batch_approval') — the same call always logs, whether or not the
-- caller goes on to actually approve anything. ──────────────────────────
create or replace function record_selcom_balance_check(
  p_query_succeeded boolean,
  p_available_balance numeric,
  p_account_active boolean,
  p_currency text,
  p_error_message text,
  p_trigger_type text,
  p_batch_id uuid,
  p_performed_by text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not has_permission('disbursement_balance.refresh') then
    raise exception 'Missing required permission: disbursement_balance.refresh';
  end if;
  if p_trigger_type not in ('manual', 'batch_approval') then
    raise exception 'Invalid trigger_type: %', p_trigger_type;
  end if;

  insert into selcom_balance_checks (
    checked_by, trigger_type, query_succeeded, available_balance, account_active, currency, error_message, batch_id
  ) values (
    p_performed_by, p_trigger_type, p_query_succeeded, p_available_balance, p_account_active, p_currency, p_error_message, p_batch_id
  )
  returning id into v_id;

  if p_query_succeeded then
    update selcom_balance_snapshot set
      available_balance = p_available_balance,
      account_active = p_account_active,
      currency = p_currency,
      checked_at = now(),
      checked_by = p_performed_by
    where id = true;
  end if;

  return v_id;
end;
$$;

revoke execute on function record_selcom_balance_check(boolean, numeric, boolean, text, text, text, uuid, text) from public;
grant execute on function record_selcom_balance_check(boolean, numeric, boolean, text, text, text, uuid, text) to authenticated;
revoke execute on function record_selcom_balance_check(boolean, numeric, boolean, text, text, text, uuid, text) from anon;

-- ── reserve_selcom_balance_for_batch(): locks selcom_balance_snapshot
-- (the single shared lock target — see its header comment), so this is
-- the one place "prevent two batches from reserving the same available
-- funds" is actually enforced, regardless of how many concurrent
-- approvals are in flight. Uses the FRESH p_available_balance the caller
-- just fetched from Selcom (never the cached snapshot value) as the
-- authoritative figure for THIS check, while still updating the cache via
-- record_selcom_balance_check() for display purposes elsewhere. ────────
create or replace function reserve_selcom_balance_for_batch(
  p_batch_id uuid,
  p_available_balance numeric,
  p_performed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_already_reserved numeric;
begin
  if not (has_permission('settlement.approve') or has_permission('disbursement_balance.refresh')) then
    raise exception 'Missing required permission: settlement.approve';
  end if;

  -- Global lock — every concurrent call to this function blocks here
  -- until the previous one commits, so "available minus already reserved"
  -- is always computed against a consistent, serialized view.
  perform 1 from selcom_balance_snapshot where id = true for update;

  select * into v_batch from settlement_batches where id = p_batch_id;
  if not found then
    raise exception 'Settlement batch not found';
  end if;

  if exists (select 1 from selcom_balance_reservations where batch_id = p_batch_id) then
    -- Idempotent no-op: this batch already has a reservation (e.g. a
    -- retried call) — never reserve the same batch twice.
    return;
  end if;

  select coalesce(sum(reserved_amount), 0) into v_already_reserved
    from selcom_balance_reservations where status = 'active';

  if p_available_balance - v_already_reserved < v_batch.merchant_net_total then
    raise exception 'Insufficient cleared Selcom disbursement balance: available %, already reserved for other batches %, this batch requires %.',
      p_available_balance, v_already_reserved, v_batch.merchant_net_total;
  end if;

  insert into selcom_balance_reservations (batch_id, reserved_amount, created_by)
  values (p_batch_id, v_batch.merchant_net_total, p_performed_by);
end;
$$;

revoke execute on function reserve_selcom_balance_for_batch(uuid, numeric, text) from public;
grant execute on function reserve_selcom_balance_for_batch(uuid, numeric, text) to authenticated;
revoke execute on function reserve_selcom_balance_for_batch(uuid, numeric, text) from anon;

-- ── maybe_release_batch_reservation(): internal helper, called from every
-- function that can move a merchant_payouts row into a terminal status
-- (apply_merchant_payout_result, apply_payout_status_check_result,
-- process_selcom_callback — see their updated bodies below/in this
-- migration's companion edits). Never exposed as a direct RPC entrypoint
-- — revoked from every role, callable only as a plain SQL function call
-- from within another already-permission-checked SECURITY DEFINER
-- function, from which it inherits the elevated execution context. Not
-- itself SECURITY DEFINER-permission-gated because it has no independent
-- entrypoint to gate; it still runs with definer privileges (needed to
-- UPDATE selcom_balance_reservations, which has no direct update policy)
-- because every function that calls it is. ──────────────────────────────
create or replace function maybe_release_batch_reservation(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unresolved_count integer;
begin
  if p_batch_id is null then
    return;
  end if;

  select count(*) into v_unresolved_count
  from merchant_payouts
  where batch_id = p_batch_id
    and status not in ('successful', 'failed', 'reversed', 'cancelled', 'manual_review');

  if v_unresolved_count = 0 then
    update selcom_balance_reservations
    set status = 'consumed', released_at = now()
    where batch_id = p_batch_id and status = 'active';
  end if;
end;
$$;

revoke execute on function maybe_release_batch_reservation(uuid) from public;
revoke execute on function maybe_release_batch_reservation(uuid) from authenticated;
revoke execute on function maybe_release_batch_reservation(uuid) from anon;

-- ── release_selcom_balance_reservation(): manual override for Finance —
-- e.g. a batch is abandoned before all its payouts resolve. Never touches
-- merchant_payouts or settlement_batches; only ever changes this ledger
-- row. ────────────────────────────────────────────────────────────────
create or replace function release_selcom_balance_reservation(
  p_batch_id uuid,
  p_release_reason text,
  p_performed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('disbursement_balance.refresh') then
    raise exception 'Missing required permission: disbursement_balance.refresh';
  end if;
  if p_release_reason is null or length(trim(p_release_reason)) = 0 then
    raise exception 'A reason is required to release a balance reservation';
  end if;

  update selcom_balance_reservations
  set status = 'released', released_at = now(), release_reason = p_release_reason
  where batch_id = p_batch_id and status = 'active';

  if not found then
    raise exception 'No active reservation found for this batch';
  end if;
end;
$$;

revoke execute on function release_selcom_balance_reservation(uuid, text, text) from public;
grant execute on function release_selcom_balance_reservation(uuid, text, text) to authenticated;
revoke execute on function release_selcom_balance_reservation(uuid, text, text) from anon;

-- ── approve_settlement_batch(): widened to require a live balance figure
-- and to reserve funds atomically with finalising approval. The OLD
-- 2-parameter overload is explicitly dropped — CREATE OR REPLACE does
-- NOT replace a function when the parameter list changes; it silently
-- creates a second overload instead, which is exactly the bug this
-- codebase has been bitten by before. Dropping first, then creating,
-- guarantees exactly one overload survives. ──────────────────────────────
drop function if exists approve_settlement_batch(uuid, text);

create or replace function approve_settlement_batch(p_batch_id uuid, p_approval_notes text, p_available_balance numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
  v_will_finalize boolean;
begin
  if not has_permission('settlement.approve') then
    raise exception 'Missing required permission: settlement.approve';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status <> 'ready_for_approval' then
    raise exception 'Only a batch ready for approval can be approved';
  end if;
  if v_batch.compliance_hold then
    raise exception 'This batch is on compliance hold and cannot be approved';
  end if;
  if v_batch.prepared_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from the preparer';
  end if;
  if v_batch.reviewed_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from the reviewer';
  end if;

  -- This call will actually finalise the batch (status -> 'approved')
  -- either because it doesn't require dual approval at all, or because
  -- this is the second of a dual-approval pair. The FIRST approval of a
  -- dual-approval batch never finalises anything yet, so it never
  -- reserves funds either — only the call that actually commits to paying
  -- the batch out does.
  v_will_finalize := v_batch.approved_by is not null or not v_batch.requires_dual_approval;

  if v_will_finalize then
    perform reserve_selcom_balance_for_batch(p_batch_id, p_available_balance, v_performer);
  end if;

  if v_batch.approved_by is null then
    update settlement_batches set
      approved_by = v_performer,
      approved_at = now(),
      approval_notes = p_approval_notes,
      status = case when requires_dual_approval then status else 'approved' end
    where id = p_batch_id;

    insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
    values (p_batch_id, 'approved_first', v_performer, p_approval_notes);
  else
    if not v_batch.requires_dual_approval then
      raise exception 'This batch does not require a second approval';
    end if;
    if v_batch.approved_by = v_performer then
      raise exception 'Maker-checker violation: the second approver must be different from the first approver';
    end if;
    update settlement_batches set
      second_approved_by = v_performer,
      second_approved_at = now(),
      status = 'approved'
    where id = p_batch_id;

    insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
    values (p_batch_id, 'approved_second', v_performer, p_approval_notes);
  end if;
end;
$$;

revoke execute on function approve_settlement_batch(uuid, text, numeric) from public;
grant execute on function approve_settlement_batch(uuid, text, numeric) to authenticated;
revoke execute on function approve_settlement_batch(uuid, text, numeric) from anon;

-- ── Hook the auto-release into every function that can move a payout to
-- a terminal status. Same signatures as before in every case (a true
-- in-place CREATE OR REPLACE, not a new overload) — only the body gains
-- one line near the end. ─────────────────────────────────────────────────

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
  v_max_hours integer;
begin
  if not has_permission('payouts.submit') then
    raise exception 'Missing required permission: payouts.submit';
  end if;
  if p_status not in ('processing', 'successful', 'failed', 'unknown') then
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

  select coalesce(payout_status_check_max_hours, 48) into v_max_hours from company_settings limit 1;

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
    selcom_receipt = coalesce(p_selcom_receipt, selcom_receipt),
    next_status_check_at = case when p_status in ('processing', 'unknown') then now() + interval '1 minute' else null end,
    status_check_expires_at = case
      when p_status in ('processing', 'unknown') then coalesce(status_check_expires_at, now() + make_interval(hours => v_max_hours))
      else status_check_expires_at
    end
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'result_' || p_status, v_performer, p_failure_reason);

  if p_status in ('successful', 'failed') then
    perform maybe_release_batch_reservation(v_payout.batch_id);
  end if;
end;
$$;

revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) to authenticated;
revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from anon;

create or replace function apply_payout_status_check_result(
  p_payout_id uuid,
  p_query_started_at timestamp with time zone,
  p_mapped_status text,
  p_external_status text,
  p_provider_payout_reference text,
  p_selcom_receipt text,
  p_failure_code text,
  p_failure_reason text,
  p_backoff_minutes integer,
  p_performed_by text
)
returns table (
  applied boolean,
  skip_reason text,
  new_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_terminal_statuses constant text[] := array['successful', 'failed', 'reversed', 'cancelled', 'manual_review'];
begin
  if not (has_permission('payouts.submit') or auth.role() = 'service_role') then
    raise exception 'Missing required permission: payouts.submit';
  end if;
  if p_mapped_status not in ('processing', 'successful', 'failed', 'unknown') then
    raise exception 'Invalid mapped status: %', p_mapped_status;
  end if;

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;

  if v_payout.status = any(v_terminal_statuses) then
    return query select false, 'payout_already_finalised'::text, v_payout.status;
    return;
  end if;

  if v_payout.last_status_check_started_at is not null and p_query_started_at < v_payout.last_status_check_started_at then
    return query select false, 'superseded_by_newer_check'::text, v_payout.status;
    return;
  end if;

  update merchant_payouts set
    status = p_mapped_status,
    provider_payout_reference = coalesce(p_provider_payout_reference, provider_payout_reference),
    selcom_receipt = coalesce(p_selcom_receipt, selcom_receipt),
    failure_code = case when p_mapped_status = 'failed' then p_failure_code else failure_code end,
    failure_reason = case when p_mapped_status = 'failed' then p_failure_reason else failure_reason end,
    completed_at = case when p_mapped_status in ('successful', 'failed') then now() else completed_at end,
    last_status_check_at = now(),
    last_status_check_started_at = p_query_started_at,
    status_check_count = status_check_count + 1,
    next_status_check_at = case when p_mapped_status in ('successful', 'failed') then null else now() + make_interval(mins => p_backoff_minutes) end
  where id = p_payout_id;

  if p_mapped_status is distinct from v_payout.status then
    insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
    values (
      p_payout_id,
      'status_check_' || p_mapped_status,
      p_performed_by,
      'External status: ' || coalesce(p_external_status, 'n/a')
    );
  end if;

  if p_mapped_status in ('successful', 'failed') then
    perform maybe_release_batch_reservation(v_payout.batch_id);
  end if;

  return query select true, null::text, p_mapped_status;
end;
$$;

revoke execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) from public;
grant execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) to authenticated;
revoke execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) from anon;

create or replace function process_selcom_callback(
  p_reference_id text,
  p_raw_status text,
  p_selcom_receipt text,
  p_amount text,
  p_masked_sender_account_number text,
  p_sender_account_name text,
  p_masked_recipient_account_number text,
  p_recipient_name text,
  p_charges jsonb,
  p_source_ip text,
  p_performed_by text,
  p_dry_run boolean default false
)
returns table (
  outcome text,
  payout_id uuid,
  rejection_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_payout_id uuid;
  v_outcome text;
  v_rejection text;
begin
  if not (has_permission('payouts.submit') or auth.role() = 'service_role') then
    raise exception 'Missing required permission: payouts.submit';
  end if;

  if p_raw_status is distinct from 'SUCCESS' then
    v_outcome := 'unexpected_status';
    v_rejection := format('Callback status was not SUCCESS (got: %s).', p_raw_status);
  else
    select * into v_payout from merchant_payouts where payout_reference = p_reference_id for update;

    if not found then
      v_outcome := 'reference_not_found';
      v_rejection := 'No payout found for this reference_id.';
    else
      v_payout_id := v_payout.id;

      if v_payout.status = 'successful' then
        v_outcome := 'duplicate';
        v_rejection := 'Payout is already marked successful.';
      elsif v_payout.status in ('failed', 'reversed', 'cancelled', 'manual_review') then
        v_outcome := 'invalid_state';
        v_rejection := format('Payout is already in terminal state: %s.', v_payout.status);
      elsif v_payout.status not in ('submitted', 'processing', 'unknown') then
        v_outcome := 'invalid_state';
        v_rejection := format('Payout has not been submitted yet (status: %s).', v_payout.status);
      elsif not exists (select 1 from merchants where id = v_payout.merchant_id) then
        v_outcome := 'invalid_state';
        v_rejection := 'Payout has no valid associated merchant.';
      elsif p_amount is not null and p_amount::numeric is distinct from v_payout.amount then
        v_outcome := 'amount_mismatch';
        v_rejection := 'Callback amount does not match the payout amount.';
      elsif p_masked_recipient_account_number is not null and v_payout.beneficiary_id is not null
        and not exists (
          select 1 from merchant_settlement_beneficiaries
          where id = v_payout.beneficiary_id and masked_destination_value = p_masked_recipient_account_number
        ) then
        v_outcome := 'destination_mismatch';
        v_rejection := 'Callback destination account does not match the payout beneficiary on file.';
      else
        v_outcome := case when p_dry_run then 'dry_run_ok' else 'processed' end;
      end if;
    end if;
  end if;

  if v_outcome = 'processed' then
    update merchant_payouts set
      status = 'successful',
      provider_payout_reference = coalesce(p_selcom_receipt, provider_payout_reference),
      selcom_receipt = coalesce(p_selcom_receipt, selcom_receipt),
      completed_at = now(),
      last_status_check_at = now(),
      next_status_check_at = null
    where id = v_payout_id;

    insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
    values (v_payout_id, 'callback_success', p_performed_by, 'Selcom callback confirmed successful disbursement.');

    perform maybe_release_batch_reservation(v_payout.batch_id);
  end if;

  insert into selcom_callback_events (
    reference_id, raw_status, selcom_receipt, amount,
    masked_sender_account_number, sender_account_name,
    masked_recipient_account_number, recipient_name, charges,
    source_ip, payout_id, outcome, dry_run, rejection_reason
  ) values (
    p_reference_id, p_raw_status, p_selcom_receipt, p_amount,
    p_masked_sender_account_number, p_sender_account_name,
    p_masked_recipient_account_number, p_recipient_name, p_charges,
    p_source_ip, v_payout_id, v_outcome, p_dry_run, v_rejection
  );

  return query select v_outcome, v_payout_id, v_rejection;
end;
$$;

revoke execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) from public;
grant execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) to authenticated;
revoke execute on function process_selcom_callback(text, text, text, text, text, text, text, text, jsonb, text, text, boolean) from anon;
