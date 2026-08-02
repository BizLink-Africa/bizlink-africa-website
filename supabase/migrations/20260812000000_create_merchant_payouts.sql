-- Merchant Payouts module. No live disbursement execution exists anywhere
-- in this migration or the app code that uses it — submission calls a
-- clearly-labeled sandbox/mock adapter (see
-- src/lib/payouts/disbursement-adapter.ts) until a real provider
-- integration is configured against official API documentation.
--
-- This sits one layer below Settlement Batches: an approved batch's
-- settlement_batch_lines describe what each merchant is owed; a
-- merchant_payouts row is the actual disbursement attempt for one line,
-- with its own maker-checker (requested_by/approved_by, pairwise distinct),
-- its own retry/hold/cancel/reversal lifecycle, and idempotency guarantees
-- independent of the batch's own approval workflow — a second, independent
-- control layer over real money movement, not a duplicate of the first.

-- ── merchant_payouts ─────────────────────────────────────────────────────
create table if not exists merchant_payouts (
  id uuid primary key default gen_random_uuid(),
  payout_reference text not null unique,

  batch_id uuid not null references settlement_batches(id),
  -- One payout row per settlement line, ever — the unique constraint below
  -- is what makes payout creation idempotent and prevents ever creating two
  -- disbursement attempts for the same owed amount.
  settlement_batch_line_id uuid not null references settlement_batch_lines(id),
  merchant_id uuid not null references merchants(id),
  beneficiary_id uuid references merchant_settlement_beneficiaries(id),
  -- Copied from the beneficiary at request time so the record is legible
  -- even if the beneficiary is later changed — never the destination value
  -- itself, only its type.
  destination_type text check (destination_type is null or destination_type in ('bank_account', 'mobile_wallet')),

  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'TZS',

  -- Guarantees a retried/duplicated submitPayout() call can never result in
  -- two real disbursements — the sandbox adapter honours this today, and
  -- any future live adapter must too.
  idempotency_key text not null unique,
  provider_payout_reference text,

  status text not null default 'pending_approval' check (status in (
    'pending_approval', 'approved', 'submitted', 'processing',
    'successful', 'failed', 'reversed', 'held', 'cancelled'
  )),
  -- Captured only while held, so release_merchant_payout_hold() can restore
  -- exactly where the payout was interrupted.
  held_from_status text,

  failure_code text,
  failure_reason text,
  retry_count integer not null default 0 check (retry_count >= 0),

  requested_by text not null,
  requested_at timestamp with time zone not null default now(),

  approved_by text,
  approved_at timestamp with time zone,

  submitted_at timestamp with time zone,
  completed_at timestamp with time zone,

  reversed_by text,
  reversed_at timestamp with time zone,
  reversal_reason text,

  held_by text,
  held_at timestamp with time zone,
  hold_reason text,
  held_released_by text,
  held_released_at timestamp with time zone,

  cancelled_by text,
  cancelled_at timestamp with time zone,
  cancellation_reason text,

  created_at timestamp with time zone not null default now(),

  unique (settlement_batch_line_id)
);

alter table merchant_payouts enable row level security;
create index if not exists merchant_payouts_batch_id_idx on merchant_payouts (batch_id);
create index if not exists merchant_payouts_merchant_id_idx on merchant_payouts (merchant_id);
create index if not exists merchant_payouts_status_idx on merchant_payouts (status);

create policy "Staff can view merchant payouts with permission"
  on merchant_payouts for select to authenticated
  using (has_permission('payouts.view'));

-- No insert/update policy at all: every write goes through the SECURITY
-- DEFINER functions below, each independently checking permission,
-- identity (maker-checker), rate limits, and status preconditions.

-- Structural "no duplicate successful payout, and nothing changes after
-- success/reversal/cancellation": once terminal, a payout is frozen except
-- for the one explicit reverse_merchant_payout() transition out of
-- 'successful'.
create or replace function block_immutable_merchant_payout_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_core_changed boolean;
begin
  v_core_changed := (
    new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.merchant_id is distinct from old.merchant_id
    or new.beneficiary_id is distinct from old.beneficiary_id
    or new.batch_id is distinct from old.batch_id
    or new.settlement_batch_line_id is distinct from old.settlement_batch_line_id
    or new.idempotency_key is distinct from old.idempotency_key
  );

  -- Core fields (amount, destination, linkage) are frozen the instant a
  -- payout leaves pending_approval — regardless of whether this particular
  -- UPDATE also changes status. This is what makes a 'successful' payout's
  -- amount immutable even under a direct UPDATE that leaves status alone.
  if old.status <> 'pending_approval' and v_core_changed then
    raise exception 'Payout amount and linkage are locked once a payout leaves pending_approval.';
  end if;

  if old.status = 'successful' and new.status is distinct from old.status and new.status is distinct from 'reversed' then
    raise exception 'A successful payout can only ever transition to reversed.';
  end if;
  if old.status in ('reversed', 'cancelled') then
    raise exception 'This payout is % and immutable.', old.status;
  end if;
  if old.status = 'failed' and new.status is distinct from old.status and new.status not in ('approved', 'cancelled') then
    raise exception 'A failed payout can only be retried (back to approved) or cancelled.';
  end if;
  return new;
end;
$$;

drop trigger if exists merchant_payouts_immutable on merchant_payouts;
create trigger merchant_payouts_immutable
  before update on merchant_payouts
  for each row
  execute function block_immutable_merchant_payout_mutation();

-- ── merchant_payout_events (append-only status timeline) ────────────────
create table if not exists merchant_payout_events (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references merchant_payouts(id) on delete cascade,
  event_type text not null,
  performed_by text not null,
  performed_at timestamp with time zone not null default now(),
  notes text
);

alter table merchant_payout_events enable row level security;
create index if not exists merchant_payout_events_payout_id_idx on merchant_payout_events (payout_id, performed_at);

create policy "Staff can view merchant payout events with permission"
  on merchant_payout_events for select to authenticated
  using (has_permission('payouts.view'));

-- ── Simple, honest, server-enforced rate limit: no more than
-- p_max_actions calls to the given action type by the same performer in
-- the trailing 5 minutes. A production deployment would likely also want
-- rate limiting at the API gateway/edge — this is the DB-level backstop.
create or replace function check_merchant_payout_rate_limit(p_performer text, p_event_type text, p_max_actions integer default 30)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
  from merchant_payout_events
  where performed_by = p_performer
    and event_type = p_event_type
    and performed_at > now() - interval '5 minutes';

  if v_recent_count >= p_max_actions then
    raise exception 'Rate limit exceeded for %: too many actions in the last 5 minutes. Try again shortly.', p_event_type;
  end if;
end;
$$;

revoke execute on function check_merchant_payout_rate_limit(text, text, integer) from public;
revoke execute on function check_merchant_payout_rate_limit(text, text, integer) from anon;

-- ── create_merchant_payouts_for_batch(): the only way merchant_payouts
-- rows are created. Idempotent — safe to call more than once for the same
-- batch, since it only creates a row for a line that doesn't already have
-- one. ─────────────────────────────────────────────────────────────────
create or replace function create_merchant_payouts_for_batch(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
  v_line record;
  v_created_count integer := 0;
begin
  if not has_permission('payouts.manage') then
    raise exception 'Missing required permission: payouts.manage';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status not in ('approved', 'processing', 'partially_paid') then
    raise exception 'Only an approved batch can have payout requests created for it';
  end if;

  for v_line in
    select sbl.* from settlement_batch_lines sbl
    where sbl.batch_id = p_batch_id
      and sbl.net_amount > 0
      and not exists (select 1 from merchant_payouts mp where mp.settlement_batch_line_id = sbl.id)
  loop
    -- LEFT JOIN (not a plain lookup) so exactly one row is always inserted
    -- even when the line has no beneficiary_id at all.
    insert into merchant_payouts (
      payout_reference, batch_id, settlement_batch_line_id, merchant_id, beneficiary_id,
      destination_type, amount, currency, idempotency_key, requested_by
    )
    select
      next_finance_number('PAY'), p_batch_id, v_line.id, v_line.merchant_id, v_line.beneficiary_id,
      msb.destination_type, v_line.net_amount, 'TZS', 'PAYOUT-' || v_line.id::text, v_performer
    from (select 1) as dummy
    left join merchant_settlement_beneficiaries msb on msb.id = v_line.beneficiary_id;

    v_created_count := v_created_count + 1;

    insert into merchant_payout_events (payout_id, event_type, performed_by)
    select id, 'requested', v_performer from merchant_payouts where settlement_batch_line_id = v_line.id;
  end loop;

  return v_created_count;
end;
$$;

revoke execute on function create_merchant_payouts_for_batch(uuid) from public;
grant execute on function create_merchant_payouts_for_batch(uuid) to authenticated;
revoke execute on function create_merchant_payouts_for_batch(uuid) from anon;

-- ── approve_merchant_payout(): maker-checker — approver must differ from
-- requester. Rate-limited. ───────────────────────────────────────────────
create or replace function approve_merchant_payout(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
begin
  if not has_permission('payouts.approve') then
    raise exception 'Missing required permission: payouts.approve';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');
  perform check_merchant_payout_rate_limit(v_performer, 'approved');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'pending_approval' then
    raise exception 'Only a payout pending approval can be approved';
  end if;
  if v_payout.requested_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from the requester';
  end if;
  if v_payout.beneficiary_id is null then
    raise exception 'This payout has no beneficiary on file and cannot be approved';
  end if;

  update merchant_payouts set status = 'approved', approved_by = v_performer, approved_at = now()
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by)
  values (p_payout_id, 'approved', v_performer);
end;
$$;

revoke execute on function approve_merchant_payout(uuid) from public;
grant execute on function approve_merchant_payout(uuid) to authenticated;
revoke execute on function approve_merchant_payout(uuid) from anon;

-- ── cancel_merchant_payout(): "Cancel before submission" — only ever
-- allowed before a real submission attempt has been made. ───────────────
create or replace function cancel_merchant_payout(p_payout_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
begin
  if not (has_permission('payouts.manage') or has_permission('payouts.approve')) then
    raise exception 'Missing required permission to cancel a payout';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to cancel a payout';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status not in ('pending_approval', 'approved') then
    raise exception 'A payout can only be cancelled before it has been submitted';
  end if;

  update merchant_payouts set
    status = 'cancelled',
    cancelled_by = v_performer,
    cancelled_at = now(),
    cancellation_reason = p_reason
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'cancelled', v_performer, p_reason);
end;
$$;

revoke execute on function cancel_merchant_payout(uuid, text) from public;
grant execute on function cancel_merchant_payout(uuid, text) to authenticated;
revoke execute on function cancel_merchant_payout(uuid, text) from anon;

-- ── begin_merchant_payout_submission(): approved -> submitted. The actual
-- (sandbox/mock) adapter call happens in the app layer — see
-- src/lib/payouts/disbursement-adapter.ts — this function only performs
-- the status transition and rate-limits submission attempts. ────────────
create or replace function begin_merchant_payout_submission(p_payout_id uuid)
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
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');
  perform check_merchant_payout_rate_limit(v_performer, 'submitted');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'approved' then
    raise exception 'Only an approved payout can be submitted';
  end if;

  update merchant_payouts set status = 'submitted', submitted_at = now() where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by)
  values (p_payout_id, 'submitted', v_performer);
end;
$$;

revoke execute on function begin_merchant_payout_submission(uuid) from public;
grant execute on function begin_merchant_payout_submission(uuid) to authenticated;
revoke execute on function begin_merchant_payout_submission(uuid) from anon;

-- ── apply_merchant_payout_result(): the only way a payout's final
-- disbursement outcome is ever recorded — always the adapter's actual
-- response, never assumed. ────────────────────────────────────────────
create or replace function apply_merchant_payout_result(
  p_payout_id uuid,
  p_status text,
  p_provider_payout_reference text,
  p_failure_code text,
  p_failure_reason text
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
    completed_at = case when p_status in ('successful', 'failed') then now() else completed_at end
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'result_' || p_status, v_performer, p_failure_reason);
end;
$$;

revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text) from public;
grant execute on function apply_merchant_payout_result(uuid, text, text, text, text) to authenticated;
revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text) from anon;

-- ── retry_merchant_payout(): "Retry failed payout" with restrictions —
-- only from 'failed', only up to a fixed retry ceiling. ─────────────────
create or replace function retry_merchant_payout(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
  v_max_retries constant integer := 3;
begin
  if not (has_permission('payouts.manage') or has_permission('payouts.submit')) then
    raise exception 'Missing required permission to retry a payout';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'failed' then
    raise exception 'Only a failed payout can be retried';
  end if;
  if v_payout.retry_count >= v_max_retries then
    raise exception 'This payout has already reached the maximum of % retries', v_max_retries;
  end if;

  update merchant_payouts set
    status = 'approved',
    retry_count = retry_count + 1,
    failure_code = null,
    failure_reason = null
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'retried', v_performer, format('Retry attempt %s of %s', v_payout.retry_count + 1, v_max_retries));
end;
$$;

revoke execute on function retry_merchant_payout(uuid) from public;
grant execute on function retry_merchant_payout(uuid) to authenticated;
revoke execute on function retry_merchant_payout(uuid) from anon;

-- ── place_merchant_payout_hold() / release_merchant_payout_hold() ───────
create or replace function place_merchant_payout_hold(p_payout_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
begin
  if not has_permission('payouts.hold') then
    raise exception 'Missing required permission: payouts.hold';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to place a hold';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status in ('successful', 'reversed', 'cancelled', 'held') then
    raise exception 'This payout is % and cannot be placed on hold', v_payout.status;
  end if;

  update merchant_payouts set
    held_from_status = v_payout.status,
    status = 'held',
    held_by = v_performer,
    held_at = now(),
    hold_reason = p_reason,
    held_released_by = null,
    held_released_at = null
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'held', v_performer, p_reason);
end;
$$;

revoke execute on function place_merchant_payout_hold(uuid, text) from public;
grant execute on function place_merchant_payout_hold(uuid, text) to authenticated;
revoke execute on function place_merchant_payout_hold(uuid, text) from anon;

create or replace function release_merchant_payout_hold(p_payout_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
begin
  if not has_permission('payouts.hold') then
    raise exception 'Missing required permission: payouts.hold';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'held' then
    raise exception 'This payout is not currently on hold';
  end if;

  update merchant_payouts set
    status = coalesce(v_payout.held_from_status, 'pending_approval'),
    held_from_status = null,
    held_released_by = v_performer,
    held_released_at = now()
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'hold_released', v_performer, p_notes);
end;
$$;

revoke execute on function release_merchant_payout_hold(uuid, text) from public;
grant execute on function release_merchant_payout_hold(uuid, text) to authenticated;
revoke execute on function release_merchant_payout_hold(uuid, text) from anon;

-- ── reverse_merchant_payout(): the one way to move a payout out of
-- 'successful' — a serious, always-reasoned action. ──────────────────────
create or replace function reverse_merchant_payout(p_payout_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout record;
  v_performer text;
begin
  if not has_permission('payouts.approve') then
    raise exception 'Missing required permission: payouts.approve';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to reverse a payout';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_payout from merchant_payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found';
  end if;
  if v_payout.status <> 'successful' then
    raise exception 'Only a successful payout can be reversed';
  end if;

  update merchant_payouts set
    status = 'reversed',
    reversed_by = v_performer,
    reversed_at = now(),
    reversal_reason = p_reason
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by, notes)
  values (p_payout_id, 'reversed', v_performer, p_reason);
end;
$$;

revoke execute on function reverse_merchant_payout(uuid, text) from public;
grant execute on function reverse_merchant_payout(uuid, text) to authenticated;
revoke execute on function reverse_merchant_payout(uuid, text) from anon;

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('payouts.view', 'payouts', 'View merchant payouts and their status timeline'),
  ('payouts.manage', 'payouts', 'Request payout creation from an approved batch, cancel before submission, retry a failed payout'),
  ('payouts.approve', 'payouts', 'Approve, cancel and reverse merchant payouts'),
  ('payouts.hold', 'payouts', 'Place or release a hold on a merchant payout'),
  ('payouts.submit', 'payouts', 'Submit an approved payout to the disbursement adapter and record its result')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('cfo', 'payouts.view'), ('cfo', 'payouts.manage'), ('cfo', 'payouts.approve'), ('cfo', 'payouts.submit'),
  ('compliance_security', 'payouts.view'), ('compliance_security', 'payouts.hold'),
  ('ceo', 'payouts.view')
on conflict do nothing;

revoke execute on function create_merchant_payouts_for_batch(uuid) from anon;
revoke execute on function approve_merchant_payout(uuid) from anon;
revoke execute on function cancel_merchant_payout(uuid, text) from anon;
revoke execute on function begin_merchant_payout_submission(uuid) from anon;
revoke execute on function apply_merchant_payout_result(uuid, text, text, text, text) from anon;
revoke execute on function retry_merchant_payout(uuid) from anon;
revoke execute on function place_merchant_payout_hold(uuid, text) from anon;
revoke execute on function release_merchant_payout_hold(uuid, text) from anon;
revoke execute on function reverse_merchant_payout(uuid, text) from anon;
revoke execute on function check_merchant_payout_rate_limit(text, text, integer) from anon;
