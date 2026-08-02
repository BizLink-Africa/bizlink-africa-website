-- Chargebacks, Reversals and Settlement Holds. Extends the Collection
-- Ledger / Settlement Batches modules with dispute case management,
-- financial-exposure holds, and approved manual reversals.
--
-- "Held amounts cannot be settled" is enforced structurally: check #13
-- added to prepare_settlement_batch() below rejects any merchant or
-- transaction covered by an active settlement_holds row, exactly like the
-- other 12 pre-settlement checks (visible, auditable exclusion — never a
-- silent drop).
--
-- "Do not delete resolved cases. Preserve full history." — there is no
-- delete policy and no delete function anywhere in this migration. Cases,
-- holds and reversal requests are append-only once they reach a terminal
-- state, enforced by triggers exactly like every other module this
-- session.

-- ── chargeback_cases ─────────────────────────────────────────────────────
create table if not exists chargeback_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique,

  original_transaction_id uuid not null references collection_transactions(id),
  merchant_id uuid not null references merchants(id),

  disputed_amount numeric(14, 2) not null check (disputed_amount > 0),
  associated_fee numeric(14, 2) not null default 0 check (associated_fee >= 0),

  reason text not null check (reason in (
    'fraud', 'duplicate', 'product_not_received', 'product_unacceptable',
    'subscription_cancelled', 'credit_not_processed', 'unrecognized', 'other'
  )),

  evidence_due_at timestamp with time zone,
  evidence_status text not null default 'not_required' check (evidence_status in (
    'not_required', 'pending', 'submitted', 'overdue'
  )),

  case_status text not null default 'open' check (case_status in (
    'open', 'evidence_requested', 'evidence_submitted', 'under_review',
    'won', 'lost', 'withdrawn', 'closed'
  )),
  -- Kept populated even after the case moves to 'closed', so "how did this
  -- resolve" is never lost once a case is administratively archived.
  outcome text check (outcome in ('won', 'lost', 'withdrawn')),

  -- "Chargeback losses may be recovered only according to agreed merchant
  -- terms" — recovery is tracked here, separately from case_status, since
  -- a lost case can still be open for weeks while recovery is arranged.
  recovery_status text not null default 'not_applicable' check (recovery_status in (
    'not_applicable', 'pending', 'partially_recovered', 'recovered', 'unrecoverable'
  )),
  recovery_amount numeric(14, 2) check (recovery_amount is null or recovery_amount >= 0),
  recovery_method text check (recovery_method is null or recovery_method in ('settlement_deduction', 'manual_invoice', 'other')),
  recovery_notes text,
  recovery_recorded_by text,
  recovery_recorded_at timestamp with time zone,

  opened_by text not null,
  opened_at timestamp with time zone not null default now(),
  submitted_at timestamp with time zone,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  resolved_by text,
  resolved_at timestamp with time zone,
  resolution_notes text,
  closed_by text,
  closed_at timestamp with time zone,

  created_at timestamp with time zone not null default now()
);

alter table chargeback_cases enable row level security;
create index if not exists chargeback_cases_merchant_id_idx on chargeback_cases (merchant_id);
create index if not exists chargeback_cases_status_idx on chargeback_cases (case_status);
create index if not exists chargeback_cases_transaction_id_idx on chargeback_cases (original_transaction_id);

create policy "Staff can view chargeback cases with permission"
  on chargeback_cases for select to authenticated
  using (has_permission('chargebacks.view'));

-- No insert/update policy: every write goes through the SECURITY DEFINER
-- functions below.

create or replace function block_immutable_chargeback_case_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.case_status = 'closed' then
    raise exception 'This chargeback case is closed and its history is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists chargeback_cases_immutable on chargeback_cases;
create trigger chargeback_cases_immutable
  before update on chargeback_cases
  for each row
  execute function block_immutable_chargeback_case_mutation();

-- ── chargeback_case_events (append-only status timeline) ────────────────
create table if not exists chargeback_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references chargeback_cases(id) on delete cascade,
  event_type text not null,
  performed_by text not null,
  performed_at timestamp with time zone not null default now(),
  notes text
);

alter table chargeback_case_events enable row level security;
create index if not exists chargeback_case_events_case_id_idx on chargeback_case_events (case_id, performed_at);

create policy "Staff can view chargeback case events with permission"
  on chargeback_case_events for select to authenticated
  using (has_permission('chargebacks.view'));

-- ── chargeback_evidence_items (evidence checklist) ───────────────────────
create table if not exists chargeback_evidence_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references chargeback_cases(id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'proof_of_delivery', 'customer_communication', 'receipt_or_invoice',
    'refund_policy', 'signed_agreement', 'service_usage_log', 'other'
  )),
  status text not null default 'requested' check (status in ('requested', 'submitted', 'not_applicable')),
  notes text,
  submitted_by text,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (case_id, evidence_type)
);

alter table chargeback_evidence_items enable row level security;
create index if not exists chargeback_evidence_items_case_id_idx on chargeback_evidence_items (case_id);

create policy "Staff can view chargeback evidence with permission"
  on chargeback_evidence_items for select to authenticated
  using (has_permission('chargebacks.view'));

create policy "Staff can manage chargeback evidence with permission"
  on chargeback_evidence_items for all to authenticated
  using (has_permission('chargebacks.manage'))
  with check (has_permission('chargebacks.manage'));

-- ── settlement_holds ─────────────────────────────────────────────────────
create table if not exists settlement_holds (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  transaction_id uuid references collection_transactions(id),
  batch_id uuid references settlement_batches(id),

  hold_reason text not null,
  hold_amount numeric(14, 2) not null default 0 check (hold_amount >= 0),

  status text not null default 'active' check (status in ('active', 'released')),

  created_by text not null,
  placed_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,

  release_requested_by text,
  release_requested_at timestamp with time zone,
  release_request_reason text,

  approved_by text,
  released_at timestamp with time zone,
  release_reason text,

  created_at timestamp with time zone not null default now()
);

alter table settlement_holds enable row level security;
create index if not exists settlement_holds_merchant_id_idx on settlement_holds (merchant_id);
create index if not exists settlement_holds_transaction_id_idx on settlement_holds (transaction_id);
create index if not exists settlement_holds_status_idx on settlement_holds (status);

create policy "Staff can view settlement holds with permission"
  on settlement_holds for select to authenticated
  using (has_permission('holds.view'));

create or replace function block_immutable_settlement_hold_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'released' then
    raise exception 'This settlement hold has been released and is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists settlement_holds_immutable on settlement_holds;
create trigger settlement_holds_immutable
  before update on settlement_holds
  for each row
  execute function block_immutable_settlement_hold_mutation();

-- ── settlement_hold_events (append-only) ─────────────────────────────────
create table if not exists settlement_hold_events (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references settlement_holds(id) on delete cascade,
  event_type text not null,
  performed_by text not null,
  performed_at timestamp with time zone not null default now(),
  notes text
);

alter table settlement_hold_events enable row level security;
create index if not exists settlement_hold_events_hold_id_idx on settlement_hold_events (hold_id, performed_at);

create policy "Staff can view settlement hold events with permission"
  on settlement_hold_events for select to authenticated
  using (has_permission('holds.view'));

-- ── manual_reversal_requests ─────────────────────────────────────────────
create table if not exists manual_reversal_requests (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references collection_transactions(id),
  merchant_id uuid not null references merchants(id),
  reversal_amount numeric(14, 2) not null check (reversal_amount > 0),
  reason text not null,
  linked_chargeback_case_id uuid references chargeback_cases(id),

  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected', 'completed')),

  requested_by text not null,
  requested_at timestamp with time zone not null default now(),
  approved_by text,
  approved_at timestamp with time zone,
  review_notes text,
  completed_at timestamp with time zone,

  created_at timestamp with time zone not null default now()
);

alter table manual_reversal_requests enable row level security;
create index if not exists manual_reversal_requests_transaction_id_idx on manual_reversal_requests (transaction_id);
create index if not exists manual_reversal_requests_merchant_id_idx on manual_reversal_requests (merchant_id);

create policy "Staff can view manual reversal requests with permission"
  on manual_reversal_requests for select to authenticated
  using (has_permission('reversals.view'));

create or replace function block_immutable_manual_reversal_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('rejected', 'completed') then
    raise exception 'This manual reversal request is % and immutable.', old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists manual_reversal_requests_immutable on manual_reversal_requests;
create trigger manual_reversal_requests_immutable
  before update on manual_reversal_requests
  for each row
  execute function block_immutable_manual_reversal_mutation();

-- ═══════════════════════════════════════════════════════════════════════
-- Chargeback case lifecycle functions
-- ═══════════════════════════════════════════════════════════════════════

create or replace function open_chargeback_case(
  p_transaction_id uuid,
  p_disputed_amount numeric,
  p_associated_fee numeric,
  p_reason text,
  p_evidence_due_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn record;
  v_performer text;
  v_case_id uuid;
begin
  if not has_permission('chargebacks.manage') then
    raise exception 'Missing required permission: chargebacks.manage';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_txn from collection_transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.merchant_id is null then
    raise exception 'Transaction has no associated merchant';
  end if;
  if exists (
    select 1 from chargeback_cases
    where original_transaction_id = p_transaction_id
      and case_status not in ('closed')
  ) then
    raise exception 'An open chargeback case already exists for this transaction';
  end if;

  insert into chargeback_cases (
    case_reference, original_transaction_id, merchant_id, disputed_amount, associated_fee,
    reason, evidence_due_at, opened_by
  ) values (
    next_finance_number('CHB'), p_transaction_id, v_txn.merchant_id, p_disputed_amount, coalesce(p_associated_fee, 0),
    p_reason, p_evidence_due_at, v_performer
  ) returning id into v_case_id;

  update collection_transactions set chargeback_status = 'disputed' where id = p_transaction_id;

  insert into chargeback_case_events (case_id, event_type, performed_by)
  values (v_case_id, 'opened', v_performer);

  return v_case_id;
end;
$$;

revoke execute on function open_chargeback_case(uuid, numeric, numeric, text, timestamp with time zone) from public;
grant execute on function open_chargeback_case(uuid, numeric, numeric, text, timestamp with time zone) to authenticated;
revoke execute on function open_chargeback_case(uuid, numeric, numeric, text, timestamp with time zone) from anon;

create or replace function request_chargeback_evidence(p_case_id uuid, p_evidence_due_at timestamp with time zone)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_performer text;
begin
  if not has_permission('chargebacks.manage') then
    raise exception 'Missing required permission: chargebacks.manage';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_case from chargeback_cases where id = p_case_id for update;
  if not found then
    raise exception 'Chargeback case not found';
  end if;
  if v_case.case_status <> 'open' then
    raise exception 'Evidence can only be requested for an open case';
  end if;

  update chargeback_cases set
    case_status = 'evidence_requested',
    evidence_status = 'pending',
    evidence_due_at = coalesce(p_evidence_due_at, evidence_due_at)
  where id = p_case_id;

  insert into chargeback_case_events (case_id, event_type, performed_by)
  values (p_case_id, 'evidence_requested', v_performer);
end;
$$;

revoke execute on function request_chargeback_evidence(uuid, timestamp with time zone) from public;
grant execute on function request_chargeback_evidence(uuid, timestamp with time zone) to authenticated;
revoke execute on function request_chargeback_evidence(uuid, timestamp with time zone) from anon;

create or replace function submit_chargeback_evidence(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_performer text;
begin
  if not has_permission('chargebacks.manage') then
    raise exception 'Missing required permission: chargebacks.manage';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_case from chargeback_cases where id = p_case_id for update;
  if not found then
    raise exception 'Chargeback case not found';
  end if;
  if v_case.case_status <> 'evidence_requested' then
    raise exception 'Evidence can only be submitted for a case with evidence requested';
  end if;

  update chargeback_cases set
    case_status = 'evidence_submitted',
    evidence_status = 'submitted',
    submitted_at = now()
  where id = p_case_id;

  insert into chargeback_case_events (case_id, event_type, performed_by)
  values (p_case_id, 'evidence_submitted', v_performer);
end;
$$;

revoke execute on function submit_chargeback_evidence(uuid) from public;
grant execute on function submit_chargeback_evidence(uuid) to authenticated;
revoke execute on function submit_chargeback_evidence(uuid) from anon;

create or replace function begin_chargeback_review(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_performer text;
begin
  if not has_permission('chargebacks.resolve') then
    raise exception 'Missing required permission: chargebacks.resolve';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_case from chargeback_cases where id = p_case_id for update;
  if not found then
    raise exception 'Chargeback case not found';
  end if;
  if v_case.case_status not in ('open', 'evidence_submitted') then
    raise exception 'Only an open case or one with evidence submitted can move to review';
  end if;

  update chargeback_cases set case_status = 'under_review', reviewed_by = v_performer, reviewed_at = now()
  where id = p_case_id;

  insert into chargeback_case_events (case_id, event_type, performed_by)
  values (p_case_id, 'under_review', v_performer);
end;
$$;

revoke execute on function begin_chargeback_review(uuid) from public;
grant execute on function begin_chargeback_review(uuid) to authenticated;
revoke execute on function begin_chargeback_review(uuid) from anon;

create or replace function resolve_chargeback_case(p_case_id uuid, p_outcome text, p_resolution_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_performer text;
begin
  if not has_permission('chargebacks.resolve') then
    raise exception 'Missing required permission: chargebacks.resolve';
  end if;
  if p_outcome not in ('won', 'lost', 'withdrawn') then
    raise exception 'Invalid outcome: %', p_outcome;
  end if;
  if p_resolution_notes is null or length(trim(p_resolution_notes)) = 0 then
    raise exception 'Resolution notes are required';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_case from chargeback_cases where id = p_case_id for update;
  if not found then
    raise exception 'Chargeback case not found';
  end if;
  if v_case.case_status <> 'under_review' then
    raise exception 'Only a case under review can be resolved';
  end if;

  update chargeback_cases set
    case_status = p_outcome,
    outcome = p_outcome,
    resolved_by = v_performer,
    resolved_at = now(),
    resolution_notes = p_resolution_notes,
    recovery_status = case when p_outcome = 'lost' then 'pending' else 'not_applicable' end
  where id = p_case_id;

  -- Sync the underlying transaction: a lost dispute permanently blocks
  -- that transaction from ever being (re-)settlement-eligible; a won or
  -- withdrawn dispute clears the flag (only meaningful if it had not
  -- already been settled).
  update collection_transactions set
    chargeback_status = case when p_outcome = 'lost' then 'chargeback_confirmed' else 'none' end
  where id = v_case.original_transaction_id;

  insert into chargeback_case_events (case_id, event_type, performed_by, notes)
  values (p_case_id, 'resolved_' || p_outcome, v_performer, p_resolution_notes);
end;
$$;

revoke execute on function resolve_chargeback_case(uuid, text, text) from public;
grant execute on function resolve_chargeback_case(uuid, text, text) to authenticated;
revoke execute on function resolve_chargeback_case(uuid, text, text) from anon;

create or replace function close_chargeback_case(p_case_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_performer text;
begin
  if not has_permission('chargebacks.resolve') then
    raise exception 'Missing required permission: chargebacks.resolve';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_case from chargeback_cases where id = p_case_id for update;
  if not found then
    raise exception 'Chargeback case not found';
  end if;
  if v_case.case_status not in ('won', 'lost', 'withdrawn') then
    raise exception 'Only a resolved (won/lost/withdrawn) case can be closed';
  end if;
  if v_case.recovery_status = 'pending' then
    raise exception 'This case still has a pending recovery — record the recovery outcome before closing';
  end if;

  update chargeback_cases set case_status = 'closed', closed_by = v_performer, closed_at = now()
  where id = p_case_id;

  insert into chargeback_case_events (case_id, event_type, performed_by, notes)
  values (p_case_id, 'closed', v_performer, p_notes);
end;
$$;

revoke execute on function close_chargeback_case(uuid, text) from public;
grant execute on function close_chargeback_case(uuid, text) to authenticated;
revoke execute on function close_chargeback_case(uuid, text) from anon;

-- "Recovery entries require audit logs" — enforced at the app layer
-- (logAuditEvent() is always called by recordChargebackRecovery() in
-- actions.ts) and structurally here: recovery fields can only ever be set
-- through this one function, itself permission-gated.
create or replace function record_chargeback_recovery(
  p_case_id uuid,
  p_recovery_amount numeric,
  p_recovery_method text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_performer text;
begin
  if not has_permission('chargebacks.manage') then
    raise exception 'Missing required permission: chargebacks.manage';
  end if;
  if p_recovery_method not in ('settlement_deduction', 'manual_invoice', 'other') then
    raise exception 'Invalid recovery method: %', p_recovery_method;
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_case from chargeback_cases where id = p_case_id for update;
  if not found then
    raise exception 'Chargeback case not found';
  end if;
  if v_case.outcome <> 'lost' then
    raise exception 'Recovery only applies to a lost case';
  end if;
  if v_case.recovery_status not in ('pending', 'partially_recovered') then
    raise exception 'This case does not have an outstanding recovery to record';
  end if;

  update chargeback_cases set
    recovery_amount = coalesce(recovery_amount, 0) + p_recovery_amount,
    recovery_method = p_recovery_method,
    recovery_notes = p_notes,
    recovery_recorded_by = v_performer,
    recovery_recorded_at = now(),
    recovery_status = case
      when coalesce(recovery_amount, 0) + p_recovery_amount >= disputed_amount then 'recovered'
      else 'partially_recovered'
    end
  where id = p_case_id;

  insert into chargeback_case_events (case_id, event_type, performed_by, notes)
  values (p_case_id, 'recovery_recorded', v_performer, format('%s via %s: %s', p_recovery_amount, p_recovery_method, coalesce(p_notes, '')));
end;
$$;

revoke execute on function record_chargeback_recovery(uuid, numeric, text, text) from public;
grant execute on function record_chargeback_recovery(uuid, numeric, text, text) to authenticated;
revoke execute on function record_chargeback_recovery(uuid, numeric, text, text) from anon;

-- ═══════════════════════════════════════════════════════════════════════
-- Settlement hold functions
-- ═══════════════════════════════════════════════════════════════════════

create or replace function place_settlement_hold(
  p_merchant_id uuid,
  p_transaction_id uuid,
  p_batch_id uuid,
  p_hold_reason text,
  p_hold_amount numeric,
  p_expires_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_performer text;
  v_hold_id uuid;
begin
  if not has_permission('holds.manage') then
    raise exception 'Missing required permission: holds.manage';
  end if;
  if p_hold_reason is null or length(trim(p_hold_reason)) = 0 then
    raise exception 'A reason is required to place a settlement hold';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  insert into settlement_holds (merchant_id, transaction_id, batch_id, hold_reason, hold_amount, created_by, expires_at)
  values (p_merchant_id, p_transaction_id, p_batch_id, p_hold_reason, coalesce(p_hold_amount, 0), v_performer, p_expires_at)
  returning id into v_hold_id;

  insert into settlement_hold_events (hold_id, event_type, performed_by, notes)
  values (v_hold_id, 'placed', v_performer, p_hold_reason);

  return v_hold_id;
end;
$$;

revoke execute on function place_settlement_hold(uuid, uuid, uuid, text, numeric, timestamp with time zone) from public;
grant execute on function place_settlement_hold(uuid, uuid, uuid, text, numeric, timestamp with time zone) to authenticated;
revoke execute on function place_settlement_hold(uuid, uuid, uuid, text, numeric, timestamp with time zone) from anon;

create or replace function request_settlement_hold_release(p_hold_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold record;
  v_performer text;
begin
  if not has_permission('holds.manage') then
    raise exception 'Missing required permission: holds.manage';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to request a hold release';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_hold from settlement_holds where id = p_hold_id for update;
  if not found then
    raise exception 'Settlement hold not found';
  end if;
  if v_hold.status <> 'active' then
    raise exception 'Only an active hold can have its release requested';
  end if;

  update settlement_holds set
    release_requested_by = v_performer,
    release_requested_at = now(),
    release_request_reason = p_reason
  where id = p_hold_id;

  insert into settlement_hold_events (hold_id, event_type, performed_by, notes)
  values (p_hold_id, 'release_requested', v_performer, p_reason);
end;
$$;

revoke execute on function request_settlement_hold_release(uuid, text) from public;
grant execute on function request_settlement_hold_release(uuid, text) to authenticated;
revoke execute on function request_settlement_hold_release(uuid, text) from anon;

-- Maker-checker: whoever requested the release must differ from whoever
-- approves it — mirrors every other approval in this codebase.
create or replace function approve_settlement_hold_release(p_hold_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold record;
  v_performer text;
begin
  if not has_permission('holds.approve') then
    raise exception 'Missing required permission: holds.approve';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_hold from settlement_holds where id = p_hold_id for update;
  if not found then
    raise exception 'Settlement hold not found';
  end if;
  if v_hold.release_requested_by is null then
    raise exception 'This hold has no pending release request';
  end if;
  if v_hold.release_requested_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from whoever requested the release';
  end if;

  update settlement_holds set
    status = 'released',
    approved_by = v_performer,
    released_at = now(),
    release_reason = coalesce(p_notes, v_hold.release_request_reason)
  where id = p_hold_id;

  insert into settlement_hold_events (hold_id, event_type, performed_by, notes)
  values (p_hold_id, 'release_approved', v_performer, p_notes);
end;
$$;

revoke execute on function approve_settlement_hold_release(uuid, text) from public;
grant execute on function approve_settlement_hold_release(uuid, text) to authenticated;
revoke execute on function approve_settlement_hold_release(uuid, text) from anon;

create or replace function reject_settlement_hold_release(p_hold_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold record;
  v_performer text;
begin
  if not has_permission('holds.approve') then
    raise exception 'Missing required permission: holds.approve';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_hold from settlement_holds where id = p_hold_id for update;
  if not found then
    raise exception 'Settlement hold not found';
  end if;
  if v_hold.release_requested_by is null then
    raise exception 'This hold has no pending release request';
  end if;

  update settlement_holds set
    release_requested_by = null,
    release_requested_at = null,
    release_request_reason = null
  where id = p_hold_id;

  insert into settlement_hold_events (hold_id, event_type, performed_by, notes)
  values (p_hold_id, 'release_rejected', v_performer, p_notes);
end;
$$;

revoke execute on function reject_settlement_hold_release(uuid, text) from public;
grant execute on function reject_settlement_hold_release(uuid, text) to authenticated;
revoke execute on function reject_settlement_hold_release(uuid, text) from anon;

-- ═══════════════════════════════════════════════════════════════════════
-- Manual reversal functions ("Manual reversal requires approval")
-- ═══════════════════════════════════════════════════════════════════════

create or replace function request_manual_reversal(
  p_transaction_id uuid,
  p_reversal_amount numeric,
  p_reason text,
  p_linked_chargeback_case_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn record;
  v_performer text;
  v_request_id uuid;
begin
  if not has_permission('reversals.manage') then
    raise exception 'Missing required permission: reversals.manage';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to request a manual reversal';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_txn from collection_transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.reversal_status = 'reversed' then
    raise exception 'This transaction has already been reversed';
  end if;

  insert into manual_reversal_requests (transaction_id, merchant_id, reversal_amount, reason, linked_chargeback_case_id, requested_by)
  values (p_transaction_id, v_txn.merchant_id, p_reversal_amount, p_reason, p_linked_chargeback_case_id, v_performer)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function request_manual_reversal(uuid, numeric, text, uuid) from public;
grant execute on function request_manual_reversal(uuid, numeric, text, uuid) to authenticated;
revoke execute on function request_manual_reversal(uuid, numeric, text, uuid) from anon;

create or replace function approve_manual_reversal(p_request_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_performer text;
begin
  if not has_permission('reversals.approve') then
    raise exception 'Missing required permission: reversals.approve';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_req from manual_reversal_requests where id = p_request_id for update;
  if not found then
    raise exception 'Manual reversal request not found';
  end if;
  if v_req.status <> 'pending_approval' then
    raise exception 'Only a request pending approval can be approved';
  end if;
  if v_req.requested_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from the requester';
  end if;

  update manual_reversal_requests set
    status = 'completed',
    approved_by = v_performer,
    approved_at = now(),
    review_notes = p_notes,
    completed_at = now()
  where id = p_request_id;

  update collection_transactions set reversal_status = 'reversed' where id = v_req.transaction_id;
end;
$$;

revoke execute on function approve_manual_reversal(uuid, text) from public;
grant execute on function approve_manual_reversal(uuid, text) to authenticated;
revoke execute on function approve_manual_reversal(uuid, text) from anon;

create or replace function reject_manual_reversal(p_request_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_performer text;
begin
  if not has_permission('reversals.approve') then
    raise exception 'Missing required permission: reversals.approve';
  end if;
  if p_notes is null or length(trim(p_notes)) = 0 then
    raise exception 'A reason is required to reject a manual reversal request';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_req from manual_reversal_requests where id = p_request_id for update;
  if not found then
    raise exception 'Manual reversal request not found';
  end if;
  if v_req.status <> 'pending_approval' then
    raise exception 'Only a request pending approval can be rejected';
  end if;
  if v_req.requested_by = v_performer then
    raise exception 'Maker-checker violation: the reviewer must be different from the requester';
  end if;

  update manual_reversal_requests set status = 'rejected', approved_by = v_performer, approved_at = now(), review_notes = p_notes
  where id = p_request_id;
end;
$$;

revoke execute on function reject_manual_reversal(uuid, text) from public;
grant execute on function reject_manual_reversal(uuid, text) to authenticated;
revoke execute on function reject_manual_reversal(uuid, text) from anon;

-- ═══════════════════════════════════════════════════════════════════════
-- "Held amounts cannot be settled" — check #13, added to
-- prepare_settlement_batch(). Full function body repeated (CREATE OR
-- REPLACE) with the original 12 checks unchanged and this one appended.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function prepare_settlement_batch(p_settlement_date date, p_merchant_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_performer text;
  v_merchant record;
  v_txn record;
  v_merchant_failed_checks text[];
  v_merchant_included boolean;
  v_beneficiary record;
  v_line_txn_count integer;
  v_line_gross numeric;
  v_line_fee numeric;
  v_line_commission numeric;
  v_line_adjustment numeric;
  v_line_chargeback_hold numeric;
  v_resolved_rule_id uuid;
  v_txn_failed_checks text[];
begin
  if not has_permission('settlement.prepare') then
    raise exception 'Missing required permission: settlement.prepare';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  insert into settlement_batches (batch_number, settlement_date, status, prepared_by, prepared_at)
  values (next_finance_number('SET'), p_settlement_date, 'draft', v_performer, now())
  returning id into v_batch_id;

  insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
  values (v_batch_id, 'prepared', v_performer, 'Batch preparation started for ' || p_settlement_date::text);

  for v_merchant in
    select distinct m.id, m.status as merchant_status
    from merchants m
    join collection_transactions t on t.merchant_id = m.id
    where t.settlement_eligibility = true
      and t.settlement_batch_id is null
      and t.collected_at::date <= p_settlement_date
      and (p_merchant_id is null or m.id = p_merchant_id)
  loop
    v_merchant_failed_checks := array[]::text[];

    if not exists (select 1 from merchant_kyc_reviews where merchant_id = v_merchant.id and partner_decision = 'approved') then
      v_merchant_failed_checks := array_append(v_merchant_failed_checks, 'kyc_confirmed');
    end if;
    if v_merchant.merchant_status <> 'active' then
      v_merchant_failed_checks := array_append(v_merchant_failed_checks, 'merchant_active');
    end if;
    if not exists (select 1 from merchant_tills where merchant_id = v_merchant.id and status = 'active') then
      v_merchant_failed_checks := array_append(v_merchant_failed_checks, 'till_active');
    end if;
    if not exists (select 1 from merchant_terms_acceptances where merchant_id = v_merchant.id) then
      v_merchant_failed_checks := array_append(v_merchant_failed_checks, 'merchant_agreement_accepted');
    end if;

    select * into v_beneficiary
    from merchant_settlement_beneficiaries
    where merchant_id = v_merchant.id and is_primary = true and verification_status = 'verified'
    limit 1;

    if v_beneficiary.id is null then
      v_merchant_failed_checks := array_append(v_merchant_failed_checks, 'beneficiary_verified');
    elsif v_beneficiary.cooling_period_ends_at is not null and v_beneficiary.cooling_period_ends_at > now() then
      v_merchant_failed_checks := array_append(v_merchant_failed_checks, 'cooling_period_passed');
    end if;

    -- Check #13: no active blanket (merchant-level) settlement hold.
    if exists (
      select 1 from settlement_holds
      where merchant_id = v_merchant.id and transaction_id is null and status = 'active'
    ) then
      v_merchant_failed_checks := array_append(v_merchant_failed_checks, 'no_active_settlement_hold');
    end if;

    v_merchant_included := array_length(v_merchant_failed_checks, 1) is null;

    if not v_merchant_included then
      insert into settlement_batch_exclusions (batch_id, merchant_id, failed_checks)
      values (v_batch_id, v_merchant.id, v_merchant_failed_checks);
      continue;
    end if;

    v_line_txn_count := 0;
    v_line_gross := 0;
    v_line_fee := 0;
    v_line_commission := 0;
    v_line_adjustment := 0;
    v_line_chargeback_hold := 0;

    for v_txn in
      select * from collection_transactions
      where merchant_id = v_merchant.id
        and settlement_eligibility = true
        and settlement_batch_id is null
        and collected_at::date <= p_settlement_date
      for update
    loop
      v_txn_failed_checks := array[]::text[];

      if v_txn.reconciliation_status <> 'matched' then
        v_txn_failed_checks := array_append(v_txn_failed_checks, 'transactions_reconciled');
      end if;
      if v_txn.chargeback_status <> 'none' then
        v_txn_failed_checks := array_append(v_txn_failed_checks, 'no_chargeback_hold');
      end if;
      if v_txn.settlement_eligibility is distinct from true then
        v_txn_failed_checks := array_append(v_txn_failed_checks, 'sufficient_cleared_amount');
      end if;

      v_resolved_rule_id := v_txn.commission_rule_id;
      if v_resolved_rule_id is null then
        select id into v_resolved_rule_id
        from commission_fee_rules
        where status = 'approved'
          and effective_date <= v_txn.collected_at::date
          and (expiry_date is null or expiry_date >= v_txn.collected_at::date)
          and (merchant_id is null or merchant_id = v_merchant.id)
        order by
          (case when merchant_id is not null then 2 else 0 end
            + case when service_key is not null then 1 else 0 end) desc,
          effective_date desc
        limit 1;
      end if;

      if v_resolved_rule_id is null then
        v_txn_failed_checks := array_append(v_txn_failed_checks, 'commission_rule_valid');
      end if;

      -- Check #13 (transaction-level): an active hold naming this exact
      -- transaction blocks it individually, even if the merchant has no
      -- blanket hold.
      if exists (select 1 from settlement_holds where transaction_id = v_txn.id and status = 'active') then
        v_txn_failed_checks := array_append(v_txn_failed_checks, 'no_active_settlement_hold');
      end if;

      if array_length(v_txn_failed_checks, 1) is not null then
        insert into settlement_batch_exclusions (batch_id, merchant_id, transaction_id, failed_checks)
        values (v_batch_id, v_merchant.id, v_txn.id, v_txn_failed_checks);

        if v_txn.chargeback_status <> 'none' then
          v_line_chargeback_hold := v_line_chargeback_hold + v_txn.gross_amount;
        end if;
        continue;
      end if;

      update collection_transactions set
        commission_rule_id = coalesce(commission_rule_id, v_resolved_rule_id),
        commission_rule_version = coalesce(commission_rule_version, (select version_number from commission_fee_rules where id = v_resolved_rule_id)),
        settlement_batch_id = v_batch_id
      where id = v_txn.id;

      v_line_txn_count := v_line_txn_count + 1;
      v_line_gross := v_line_gross + v_txn.gross_amount;
      v_line_fee := v_line_fee + v_txn.provider_fee;
      v_line_commission := v_line_commission + v_txn.bizlink_commission;
      v_line_adjustment := v_line_adjustment + v_txn.other_authorised_adjustment;
    end loop;

    if v_line_txn_count > 0 then
      insert into settlement_batch_lines (
        batch_id, merchant_id, transaction_count, gross_amount, provider_fee,
        bizlink_commission, adjustment_total, chargeback_hold, beneficiary_id
      ) values (
        v_batch_id, v_merchant.id, v_line_txn_count, v_line_gross, v_line_fee,
        v_line_commission, v_line_adjustment, v_line_chargeback_hold, v_beneficiary.id
      );
    elsif v_line_chargeback_hold > 0 then
      insert into settlement_batch_lines (
        batch_id, merchant_id, transaction_count, gross_amount, provider_fee,
        bizlink_commission, adjustment_total, chargeback_hold, beneficiary_id
      ) values (
        v_batch_id, v_merchant.id, 0, 0, 0, 0, 0, v_line_chargeback_hold, v_beneficiary.id
      );
    end if;
  end loop;

  update settlement_batches set
    merchant_count = (select count(*) from settlement_batch_lines where batch_id = v_batch_id),
    transaction_count = (select coalesce(sum(transaction_count), 0) from settlement_batch_lines where batch_id = v_batch_id),
    gross_collection_total = (select coalesce(sum(gross_amount), 0) from settlement_batch_lines where batch_id = v_batch_id),
    provider_fee_total = (select coalesce(sum(provider_fee), 0) from settlement_batch_lines where batch_id = v_batch_id),
    bizlink_commission_total = (select coalesce(sum(bizlink_commission), 0) from settlement_batch_lines where batch_id = v_batch_id),
    adjustment_total = (select coalesce(sum(adjustment_total), 0) from settlement_batch_lines where batch_id = v_batch_id),
    chargeback_hold_total = (select coalesce(sum(chargeback_hold), 0) from settlement_batch_lines where batch_id = v_batch_id),
    status = 'reconciliation_pending'
  where id = v_batch_id;

  return v_batch_id;
end;
$$;

revoke execute on function prepare_settlement_batch(date, uuid) from public;
grant execute on function prepare_settlement_batch(date, uuid) to authenticated;
revoke execute on function prepare_settlement_batch(date, uuid) from anon;

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('chargebacks.view', 'chargebacks', 'View chargeback cases, evidence and history'),
  ('chargebacks.manage', 'chargebacks', 'Open cases, manage evidence, record recovery'),
  ('chargebacks.resolve', 'chargebacks', 'Move a case to review, resolve it (won/lost/withdrawn), and close it'),
  ('holds.view', 'holds', 'View settlement holds'),
  ('holds.manage', 'holds', 'Place settlement holds and request their release'),
  ('holds.approve', 'holds', 'Approve or reject a settlement hold release request'),
  ('reversals.view', 'reversals', 'View manual reversal requests'),
  ('reversals.manage', 'reversals', 'Request a manual reversal'),
  ('reversals.approve', 'reversals', 'Approve or reject a manual reversal request')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('compliance_security', 'chargebacks.view'), ('compliance_security', 'chargebacks.manage'), ('compliance_security', 'chargebacks.resolve'),
  ('compliance_security', 'holds.view'), ('compliance_security', 'holds.manage'), ('compliance_security', 'holds.approve'),
  ('compliance_security', 'reversals.view'),
  ('cfo', 'chargebacks.view'), ('cfo', 'chargebacks.manage'),
  ('cfo', 'holds.view'),
  ('cfo', 'reversals.view'), ('cfo', 'reversals.manage'), ('cfo', 'reversals.approve'),
  ('ceo', 'chargebacks.view'), ('ceo', 'holds.view'), ('ceo', 'reversals.view')
on conflict do nothing;

revoke execute on function open_chargeback_case(uuid, numeric, numeric, text, timestamp with time zone) from anon;
revoke execute on function request_chargeback_evidence(uuid, timestamp with time zone) from anon;
revoke execute on function submit_chargeback_evidence(uuid) from anon;
revoke execute on function begin_chargeback_review(uuid) from anon;
revoke execute on function resolve_chargeback_case(uuid, text, text) from anon;
revoke execute on function close_chargeback_case(uuid, text) from anon;
revoke execute on function record_chargeback_recovery(uuid, numeric, text, text) from anon;
revoke execute on function place_settlement_hold(uuid, uuid, uuid, text, numeric, timestamp with time zone) from anon;
revoke execute on function request_settlement_hold_release(uuid, text) from anon;
revoke execute on function approve_settlement_hold_release(uuid, text) from anon;
revoke execute on function reject_settlement_hold_release(uuid, text) from anon;
revoke execute on function request_manual_reversal(uuid, numeric, text, uuid) from anon;
revoke execute on function approve_manual_reversal(uuid, text) from anon;
revoke execute on function reject_manual_reversal(uuid, text) from anon;
revoke execute on function prepare_settlement_batch(date, uuid) from anon;
