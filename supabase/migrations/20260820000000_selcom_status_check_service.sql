-- Selcom transaction-status polling service: scheduled + manual status
-- checks for merchant_payouts, with row-locked guarded updates so a
-- stale/out-of-order/inconclusive check can never corrupt a payout's
-- recorded state.
--
-- Design summary:
--   1. merchant_payout_status_checks: one row per status-query ATTEMPT
--      (manual or scheduled), regardless of outcome — including attempts
--      that failed to get any response at all. This is separate from the
--      existing merchant_payout_events (which stays the coarse lifecycle
--      timeline — approved/submitted/result_*) so a payout polled many
--      times doesn't flood that timeline.
--   2. apply_payout_status_check_result(): the ONLY function that ever
--      writes a status derived from a Selcom query back onto
--      merchant_payouts. Row-locks the payout, then refuses to apply
--      anything if either guard fails:
--        a) the payout is already in a terminal state (successful,
--           failed, reversed, cancelled, manual_review) — a late/stale
--           response must never downgrade a finalised payout.
--        b) the query being applied started BEFORE the query whose
--           result is already recorded (last_status_check_started_at) —
--           an older, slower response must never overwrite a newer one,
--           regardless of which one's HTTP response arrives first.
--   3. expire_payout_status_check(): moves a payout that has exceeded its
--      configured polling window (company_settings.
--      payout_status_check_max_hours) into 'manual_review' — a human
--      must resolve it; nothing here ever creates a new disbursement
--      attempt.
--   4. Both apply_payout_status_check_result() and
--      record_payout_status_check() accept calls from either an
--      authenticated staff member (has_permission) or the service-role
--      key (auth.role() = 'service_role') — the scheduled cron route runs
--      with no staff session, only the service role.

-- ── company_settings: configurable polling window (requirement: "stop
-- polling after a configurable period") ────────────────────────────────
alter table company_settings
  add column if not exists payout_status_check_max_hours integer not null default 48;

-- ── merchant_payouts: status enum gains draft/unknown/manual_review
-- (held is retained — an existing, separate hold mechanism not part of
-- this task's requested state list, but preserving it avoids breaking
-- the existing Place on Hold / Release Hold feature). Plus scheduling
-- bookkeeping columns. ───────────────────────────────────────────────
alter table merchant_payouts drop constraint if exists merchant_payouts_status_check;
alter table merchant_payouts add constraint merchant_payouts_status_check check (status in (
  'draft', 'pending_approval', 'approved', 'submitted', 'processing',
  'successful', 'failed', 'unknown', 'manual_review', 'reversed', 'held', 'cancelled'
));

alter table merchant_payouts
  add column if not exists last_status_check_at timestamp with time zone,
  add column if not exists last_status_check_started_at timestamp with time zone,
  add column if not exists status_check_count integer not null default 0,
  add column if not exists next_status_check_at timestamp with time zone,
  add column if not exists status_check_expires_at timestamp with time zone;

create index if not exists merchant_payouts_next_status_check_at_idx
  on merchant_payouts (next_status_check_at)
  where status in ('submitted', 'processing', 'unknown');

-- ── merchant_payout_status_checks ───────────────────────────────────────
create table if not exists merchant_payout_status_checks (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references merchant_payouts(id) on delete cascade,
  -- Always the payout's own payout_reference — see the migration header
  -- of 20260819000000 and src/lib/payouts/selcom-status-mapping.ts:
  -- Selcom's Transaction Query endpoint only recognises the transId
  -- originally supplied on the process request, confirmed live.
  trans_id text not null,
  trigger_type text not null check (trigger_type in ('manual', 'scheduled')),
  performed_by text not null,
  started_at timestamp with time zone not null,
  completed_at timestamp with time zone not null default now(),
  query_succeeded boolean not null,
  http_status integer,
  result text,
  resultcode text,
  -- The raw, documented Selcom status string (ACCEPTED/COMPLETED/FAILED
  -- or an undocumented value) — never invented, always exactly what was
  -- received.
  external_status text,
  mapped_status text,
  status_applied boolean not null default false,
  skip_reason text,
  error_message text,
  -- Raw response envelope — never contains a secret (see the same note
  -- on merchant_payouts.initial_response).
  raw_response jsonb
);

alter table merchant_payout_status_checks enable row level security;
create index if not exists merchant_payout_status_checks_payout_id_idx
  on merchant_payout_status_checks (payout_id, started_at desc);

create policy "Staff can view payout status checks with permission"
  on merchant_payout_status_checks for select to authenticated
  using (has_permission('payouts.view'));

-- No insert/update policy — every write goes through
-- record_payout_status_check() below (or the service-role key, which
-- bypasses RLS entirely for the scheduled cron path).

-- ── record_payout_status_check(): logs every attempt, unconditionally,
-- regardless of whether it succeeded or what (if anything) got applied.
create or replace function record_payout_status_check(
  p_payout_id uuid,
  p_trans_id text,
  p_trigger_type text,
  p_performed_by text,
  p_started_at timestamp with time zone,
  p_query_succeeded boolean,
  p_http_status integer,
  p_result text,
  p_resultcode text,
  p_external_status text,
  p_mapped_status text,
  p_status_applied boolean,
  p_skip_reason text,
  p_error_message text,
  p_raw_response jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not (has_permission('payouts.view') or auth.role() = 'service_role') then
    raise exception 'Missing required permission: payouts.view';
  end if;
  if p_trigger_type not in ('manual', 'scheduled') then
    raise exception 'Invalid trigger_type: %', p_trigger_type;
  end if;

  insert into merchant_payout_status_checks (
    payout_id, trans_id, trigger_type, performed_by, started_at, completed_at,
    query_succeeded, http_status, result, resultcode, external_status, mapped_status,
    status_applied, skip_reason, error_message, raw_response
  ) values (
    p_payout_id, p_trans_id, p_trigger_type, p_performed_by, p_started_at, now(),
    p_query_succeeded, p_http_status, p_result, p_resultcode, p_external_status, p_mapped_status,
    p_status_applied, p_skip_reason, p_error_message, p_raw_response
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function record_payout_status_check(uuid, text, text, text, timestamptz, boolean, integer, text, text, text, text, boolean, text, text, jsonb) from public;
grant execute on function record_payout_status_check(uuid, text, text, text, timestamptz, boolean, integer, text, text, text, text, boolean, text, text, jsonb) to authenticated;
revoke execute on function record_payout_status_check(uuid, text, text, text, timestamptz, boolean, integer, text, text, text, text, boolean, text, text, jsonb) from anon;

-- ── apply_payout_status_check_result(): the ONLY function that ever
-- writes a Selcom-derived status onto merchant_payouts. ─────────────────
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

  -- Guard 1: never touch an already-finalised payout. A late/stale check
  -- response must never downgrade a successful (or otherwise terminal)
  -- payout.
  if v_payout.status = any(v_terminal_statuses) then
    return query select false, 'payout_already_finalised'::text, v_payout.status;
    return;
  end if;

  -- Guard 2: never apply a response to a query that started BEFORE the
  -- query whose result is already recorded — an older, slower response
  -- must never overwrite a newer one regardless of arrival order.
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

  return query select true, null::text, p_mapped_status;
end;
$$;

revoke execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) from public;
grant execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) to authenticated;
revoke execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) from anon;

-- ── expire_payout_status_check(): stop polling after the configured
-- window, move to Manual Review. Never creates a new disbursement — only
-- ever changes merchant_payouts.status and next_status_check_at. ───────
create or replace function expire_payout_status_check(p_payout_id uuid, p_performed_by text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
begin
  if not (has_permission('payouts.submit') or auth.role() = 'service_role') then
    raise exception 'Missing required permission: payouts.submit';
  end if;

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;

  if v_payout.status not in ('submitted', 'processing', 'unknown') then
    return; -- already resolved (or otherwise not eligible) — nothing to do
  end if;

  update merchant_payouts set
    status = 'manual_review',
    next_status_check_at = null
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'moved_to_manual_review', p_performed_by, 'Automated status polling window expired without reaching a resolved status.');
end;
$$;

revoke execute on function expire_payout_status_check(uuid, text) from public;
grant execute on function expire_payout_status_check(uuid, text) to authenticated;
revoke execute on function expire_payout_status_check(uuid, text) from anon;

-- ── apply_merchant_payout_result(): unchanged signature, extended body —
-- initialises the polling schedule the first time a payout reaches
-- 'processing' (so the scheduler has a next_status_check_at to work
-- from), and clears it once a terminal state is reached. Same signature
-- as 20260819000000's version, so this is a true in-place replace (no
-- new overload — see that migration's note on the create-or-replace
-- overload pitfall). ─────────────────────────────────────────────────
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
    -- First time reaching 'processing': give the scheduler a starting
    -- point (check again in 1 minute) and lock in the expiry window once,
    -- via coalesce, so it's never pushed out by a later call.
    next_status_check_at = case when p_status = 'processing' then now() + interval '1 minute' else null end,
    status_check_expires_at = case
      when p_status = 'processing' then coalesce(status_check_expires_at, now() + make_interval(hours => v_max_hours))
      else status_check_expires_at
    end
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'result_' || p_status, v_performer, p_failure_reason);
end;
$$;

revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) to authenticated;
revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text, text, text, text, jsonb, text) from anon;
