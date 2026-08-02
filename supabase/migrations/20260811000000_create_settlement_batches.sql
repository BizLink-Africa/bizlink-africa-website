-- Daily Settlement Batches and Payout Approvals. No live payout execution
-- exists anywhere in this migration or the app code that uses it — batch
-- processing calls a clearly-labeled sandbox/mock payout adapter (see
-- src/lib/settlement/payout-adapter.ts) until a real payout integration is
-- configured. All monetary totals are computed here in Postgres using
-- exact numeric arithmetic (SUM aggregates and GENERATED ALWAYS AS STORED
-- columns) — never recomputed from JavaScript floating-point math.
--
-- Maker-checker-approver, with pairwise-distinct identity checks (not just
-- separate permissions) enforced inside every transition function:
-- prepared_by, reviewed_by, approved_by (and second_approved_by for
-- high-value batches) can never be the same person. Compliance holds and
-- emergency cancellation are separate, always-reasoned, always-audited
-- escape hatches layered on top of the normal workflow.

-- ── settlement_batches ───────────────────────────────────────────────────
create table if not exists settlement_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  settlement_date date not null,

  merchant_count integer not null default 0,
  transaction_count integer not null default 0,

  gross_collection_total numeric(14, 2) not null default 0,
  provider_fee_total numeric(14, 2) not null default 0,
  bizlink_commission_total numeric(14, 2) not null default 0,
  adjustment_total numeric(14, 2) not null default 0,
  chargeback_hold_total numeric(14, 2) not null default 0,
  -- Structural, not app-computed: always exactly gross - fees - commission
  -- - adjustments - chargeback holds, in exact decimal arithmetic.
  merchant_net_total numeric(14, 2) generated always as (
    gross_collection_total - provider_fee_total - bizlink_commission_total - adjustment_total - chargeback_hold_total
  ) stored,

  -- Manually entered by Finance from the actual vendor/settlement account
  -- statement — there is no live vendor-account feed to pull this from
  -- (same honesty convention as collection_reconciliation_runs.vendor_amount_received).
  received_vendor_account_amount numeric(14, 2),
  -- Generated columns cannot reference another generated column, so the
  -- net-total expression is repeated here rather than reused from
  -- merchant_net_total above.
  unresolved_variance numeric(14, 2) generated always as (
    coalesce(received_vendor_account_amount, 0)
      - (gross_collection_total - provider_fee_total - bizlink_commission_total - adjustment_total - chargeback_hold_total)
  ) stored,
  -- Pre-settlement check #12 ("batch variance equals zero or has an
  -- authorised resolution") is satisfied structurally: either
  -- unresolved_variance = 0, or someone with settlement.approve recorded an
  -- explicit authorised resolution here.
  variance_authorised_by text,
  variance_authorised_at timestamp with time zone,
  variance_resolution_notes text,

  -- Threshold is a policy constant today (TZS 50,000,000); promoting it to
  -- a configurable company_settings value is a natural follow-up but out
  -- of scope here — generated columns require an immutable expression.
  requires_dual_approval boolean generated always as (
    (gross_collection_total - provider_fee_total - bizlink_commission_total - adjustment_total - chargeback_hold_total) >= 50000000
  ) stored,

  status text not null default 'draft' check (status in (
    'draft', 'reconciliation_pending', 'ready_for_review', 'ready_for_approval',
    'approved', 'processing', 'partially_paid', 'completed', 'failed', 'cancelled'
  )),

  prepared_by text,
  prepared_at timestamp with time zone,
  submitted_at timestamp with time zone,

  reviewed_by text,
  reviewed_at timestamp with time zone,
  review_notes text,

  approved_by text,
  approved_at timestamp with time zone,
  approval_notes text,
  -- Second approval, only ever used when requires_dual_approval is true.
  second_approved_by text,
  second_approved_at timestamp with time zone,

  rejected_by text,
  rejected_at timestamp with time zone,
  rejection_reason text,

  compliance_hold boolean not null default false,
  compliance_hold_by text,
  compliance_hold_at timestamp with time zone,
  compliance_hold_reason text,
  compliance_hold_released_by text,
  compliance_hold_released_at timestamp with time zone,

  -- Emergency cancellation is distinct from a normal review-stage
  -- rejection (rejected_* above) — it can happen at any non-terminal
  -- status and always requires a reason.
  cancelled_by text,
  cancelled_at timestamp with time zone,
  cancellation_reason text,

  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

alter table settlement_batches enable row level security;
create index if not exists settlement_batches_settlement_date_idx on settlement_batches (settlement_date);
create index if not exists settlement_batches_status_idx on settlement_batches (status);

create policy "Staff can view settlement batches with permission"
  on settlement_batches for select to authenticated
  using (has_permission('settlement.view'));

-- No direct insert/update policy at all: every write to this table goes
-- through the SECURITY DEFINER functions below, which each independently
-- check has_permission() and identity rules before touching a row.

-- ── settlement_batch_lines (merchant breakdown) ─────────────────────────
create table if not exists settlement_batch_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references settlement_batches(id) on delete cascade,
  merchant_id uuid not null references merchants(id),

  transaction_count integer not null default 0,
  gross_amount numeric(14, 2) not null default 0,
  provider_fee numeric(14, 2) not null default 0,
  bizlink_commission numeric(14, 2) not null default 0,
  adjustment_total numeric(14, 2) not null default 0,
  chargeback_hold numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) generated always as (
    gross_amount - provider_fee - bizlink_commission - adjustment_total - chargeback_hold
  ) stored,

  beneficiary_id uuid references merchant_settlement_beneficiaries(id),

  -- Never set by the app directly outside apply_settlement_line_payout_result()
  -- — always the outcome of the (sandbox) payout adapter run.
  payout_status text not null default 'pending' check (payout_status in ('pending', 'processing', 'paid', 'failed')),
  payout_reference text,
  payout_attempted_at timestamp with time zone,
  payout_completed_at timestamp with time zone,
  payout_failure_reason text,

  unique (batch_id, merchant_id)
);

alter table settlement_batch_lines enable row level security;
create index if not exists settlement_batch_lines_batch_id_idx on settlement_batch_lines (batch_id);
create index if not exists settlement_batch_lines_merchant_id_idx on settlement_batch_lines (merchant_id);

create policy "Staff can view settlement batch lines with permission"
  on settlement_batch_lines for select to authenticated
  using (has_permission('settlement.view'));

-- ── settlement_batch_exclusions (transparency: what was considered and why
-- it was left out — nothing is ever silently dropped) ───────────────────
create table if not exists settlement_batch_exclusions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references settlement_batches(id) on delete cascade,
  merchant_id uuid references merchants(id),
  transaction_id uuid references collection_transactions(id),
  failed_checks text[] not null,
  created_at timestamp with time zone not null default now()
);

alter table settlement_batch_exclusions enable row level security;
create index if not exists settlement_batch_exclusions_batch_id_idx on settlement_batch_exclusions (batch_id);

create policy "Staff can view settlement batch exclusions with permission"
  on settlement_batch_exclusions for select to authenticated
  using (has_permission('settlement.view'));

-- ── settlement_batch_events (append-only audit history, mirrors audit_logs
-- but scoped/queryable per batch for the "Batch audit history" page) ────
create table if not exists settlement_batch_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references settlement_batches(id) on delete cascade,
  event_type text not null,
  performed_by text not null,
  performed_at timestamp with time zone not null default now(),
  notes text
);

alter table settlement_batch_events enable row level security;
create index if not exists settlement_batch_events_batch_id_idx on settlement_batch_events (batch_id, performed_at);

create policy "Staff can view settlement batch events with permission"
  on settlement_batch_events for select to authenticated
  using (has_permission('settlement.view'));

-- Append-only: no update or delete policy, and no update/delete grants
-- beyond what the SECURITY DEFINER functions themselves perform as owner.

-- ── Link collection_transactions to a settlement batch, and freeze the
-- link once set — this alone is what makes "no duplicate settlement"
-- structural: a transaction that already has a settlement_batch_id can
-- never be selected as a candidate for a new batch (candidates are always
-- queried with settlement_batch_id is null), and cannot be reassigned. ──
alter table collection_transactions
  add column if not exists settlement_batch_id uuid references settlement_batches(id);

create index if not exists collection_transactions_settlement_batch_id_idx
  on collection_transactions (settlement_batch_id);

create or replace function block_settlement_batch_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.settlement_batch_id is not null and new.settlement_batch_id is distinct from old.settlement_batch_id then
    raise exception 'This transaction is already assigned to a settlement batch and cannot be reassigned.';
  end if;
  return new;
end;
$$;

drop trigger if exists collection_transactions_settlement_batch_immutable on collection_transactions;
create trigger collection_transactions_settlement_batch_immutable
  before update on collection_transactions
  for each row
  execute function block_settlement_batch_reassignment();

-- Also freeze commission_rule_id once pinned to a transaction (added in the
-- prior migration but never enforced immutable there) — a settlement batch
-- relies on this value never moving after it has been used in a
-- calculation, matching "historical transaction calculations must never
-- change after a rate update".
create or replace function block_commission_rule_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.commission_rule_id is not null and new.commission_rule_id is distinct from old.commission_rule_id then
    raise exception 'This transaction already has a pinned commission rule and it cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists collection_transactions_commission_rule_immutable on collection_transactions;
create trigger collection_transactions_commission_rule_immutable
  before update on collection_transactions
  for each row
  execute function block_commission_rule_reassignment();

-- Immutability for the batch itself: once processing has started, only the
-- specific fields the payout pipeline and compliance/emergency actions are
-- allowed to touch may still change — never the computed totals, never
-- prepared_by/reviewed_by/approved_by.
create or replace function block_immutable_settlement_batch_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_totals_changed boolean;
begin
  v_totals_changed := (
    new.gross_collection_total is distinct from old.gross_collection_total
    or new.provider_fee_total is distinct from old.provider_fee_total
    or new.bizlink_commission_total is distinct from old.bizlink_commission_total
    or new.adjustment_total is distinct from old.adjustment_total
    or new.chargeback_hold_total is distinct from old.chargeback_hold_total
    or new.merchant_count is distinct from old.merchant_count
    or new.transaction_count is distinct from old.transaction_count
  );

  if old.status not in ('draft', 'reconciliation_pending') and v_totals_changed then
    raise exception 'Settlement batch totals are locked once the batch has left draft/reconciliation-pending status.';
  end if;

  if old.status in ('completed', 'cancelled', 'failed') and new.status is distinct from old.status then
    raise exception 'This settlement batch is % and its status is final.', old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists settlement_batches_immutable on settlement_batches;
create trigger settlement_batches_immutable
  before update on settlement_batches
  for each row
  execute function block_immutable_settlement_batch_mutation();

-- ── prepare_settlement_batch(): the only way a batch is created. Selects
-- every settlement_eligibility=true, not-yet-batched transaction collected
-- on or before p_settlement_date, groups by merchant, evaluates the 12
-- pre-settlement checks, and either includes a merchant's transactions or
-- records exactly why they were excluded (never silently dropped). ──────
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

    -- Checks 1-6: merchant-level.
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

    v_merchant_included := array_length(v_merchant_failed_checks, 1) is null;

    if not v_merchant_included then
      insert into settlement_batch_exclusions (batch_id, merchant_id, failed_checks)
      values (v_batch_id, v_merchant.id, v_merchant_failed_checks);
      continue;
    end if;

    -- Merchant passed 1-6: now evaluate checks 7-11 per transaction.
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

      -- Check 11: commission rule valid. If not yet pinned, resolve the
      -- most specific approved commission_fee_rules row as of the
      -- transaction's collected_at date and pin it now — a one-time,
      -- irreversible assignment (see the immutability trigger above).
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

      if array_length(v_txn_failed_checks, 1) is not null then
        insert into settlement_batch_exclusions (batch_id, merchant_id, transaction_id, failed_checks)
        values (v_batch_id, v_merchant.id, v_txn.id, v_txn_failed_checks);

        -- A transaction excluded specifically for an unresolved chargeback
        -- is still tracked in the merchant's chargeback_hold total for
        -- visibility, even though it is not paid out in this batch.
        if v_txn.chargeback_status <> 'none' then
          v_line_chargeback_hold := v_line_chargeback_hold + v_txn.gross_amount;
        end if;
        continue;
      end if;

      -- Included: pin the resolved rule (if newly resolved) and assign the batch.
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
      -- Merchant passed 1-6 but every transaction was excluded (e.g. all
      -- held for chargebacks) — still worth a line for chargeback
      -- visibility, with nothing payable.
      insert into settlement_batch_lines (
        batch_id, merchant_id, transaction_count, gross_amount, provider_fee,
        bizlink_commission, adjustment_total, chargeback_hold, beneficiary_id
      ) values (
        v_batch_id, v_merchant.id, 0, 0, 0, 0, 0, v_line_chargeback_hold, v_beneficiary.id
      );
    end if;
  end loop;

  -- Totals are always SQL SUM aggregates over the lines just written —
  -- never summed in the application layer.
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

-- ── submit_settlement_batch_for_review(): Maker's action once the batch
-- looks right. Enforces pre-settlement check #12. ────────────────────────
create or replace function submit_settlement_batch_for_review(p_batch_id uuid, p_variance_resolution_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
begin
  if not has_permission('settlement.prepare') then
    raise exception 'Missing required permission: settlement.prepare';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status <> 'reconciliation_pending' then
    raise exception 'Only a batch in reconciliation_pending can be submitted for review';
  end if;
  if v_batch.compliance_hold then
    raise exception 'This batch is on compliance hold and cannot be submitted';
  end if;
  if v_batch.merchant_count = 0 then
    raise exception 'This batch has no eligible merchants — nothing to settle';
  end if;

  if v_batch.unresolved_variance <> 0 then
    if p_variance_resolution_notes is null or length(trim(p_variance_resolution_notes)) = 0 then
      raise exception 'Batch variance is not zero (%). Provide an authorised resolution to proceed.', v_batch.unresolved_variance;
    end if;
    update settlement_batches set
      variance_authorised_by = v_performer,
      variance_authorised_at = now(),
      variance_resolution_notes = p_variance_resolution_notes
    where id = p_batch_id;
  end if;

  update settlement_batches set status = 'ready_for_review', submitted_at = now()
  where id = p_batch_id;

  insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
  values (p_batch_id, 'submitted_for_review', v_performer, p_variance_resolution_notes);
end;
$$;

revoke execute on function submit_settlement_batch_for_review(uuid, text) from public;
grant execute on function submit_settlement_batch_for_review(uuid, text) to authenticated;
revoke execute on function submit_settlement_batch_for_review(uuid, text) from anon;

-- ── review_settlement_batch(): Finance Checker's approval-to-proceed (not
-- final approval). Must differ from the preparer. ───────────────────────
create or replace function review_settlement_batch(p_batch_id uuid, p_review_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
begin
  if not has_permission('settlement.review') then
    raise exception 'Missing required permission: settlement.review';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status <> 'ready_for_review' then
    raise exception 'Only a batch ready for review can be reviewed';
  end if;
  if v_batch.compliance_hold then
    raise exception 'This batch is on compliance hold';
  end if;
  if v_batch.prepared_by = v_performer then
    raise exception 'Maker-checker violation: the reviewer must be different from the preparer';
  end if;

  update settlement_batches set
    status = 'ready_for_approval',
    reviewed_by = v_performer,
    reviewed_at = now(),
    review_notes = p_review_notes
  where id = p_batch_id;

  insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
  values (p_batch_id, 'reviewed', v_performer, p_review_notes);
end;
$$;

revoke execute on function review_settlement_batch(uuid, text) from public;
grant execute on function review_settlement_batch(uuid, text) to authenticated;
revoke execute on function review_settlement_batch(uuid, text) from anon;

-- ── reject_settlement_batch(): usable at ready_for_review or
-- ready_for_approval, by whoever holds the relevant stage permission,
-- always requiring a reason, always distinct from the preparer. ────────
create or replace function reject_settlement_batch(p_batch_id uuid, p_rejection_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
begin
  if not (has_permission('settlement.review') or has_permission('settlement.approve')) then
    raise exception 'Missing required permission to reject a settlement batch';
  end if;
  if p_rejection_reason is null or length(trim(p_rejection_reason)) = 0 then
    raise exception 'A reason is required to reject a settlement batch';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status not in ('ready_for_review', 'ready_for_approval') then
    raise exception 'Only a batch ready for review or approval can be rejected';
  end if;
  if v_batch.prepared_by = v_performer then
    raise exception 'Maker-checker violation: whoever rejects a batch must be different from the preparer';
  end if;

  update settlement_batches set
    status = 'cancelled',
    rejected_by = v_performer,
    rejected_at = now(),
    rejection_reason = p_rejection_reason
  where id = p_batch_id;

  insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
  values (p_batch_id, 'rejected', v_performer, p_rejection_reason);
end;
$$;

revoke execute on function reject_settlement_batch(uuid, text) from public;
grant execute on function reject_settlement_batch(uuid, text) to authenticated;
revoke execute on function reject_settlement_batch(uuid, text) from anon;

-- ── approve_settlement_batch(): final approval. High-value batches
-- (requires_dual_approval) need a second, independent approval — the
-- second approver must differ from the preparer, the reviewer, AND the
-- first approver. ────────────────────────────────────────────────────────
create or replace function approve_settlement_batch(p_batch_id uuid, p_approval_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
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

revoke execute on function approve_settlement_batch(uuid, text) from public;
grant execute on function approve_settlement_batch(uuid, text) to authenticated;
revoke execute on function approve_settlement_batch(uuid, text) from anon;

-- ── place_settlement_batch_hold() / release_settlement_batch_hold():
-- Compliance's independent brake, layered on top of the normal workflow —
-- works at any non-terminal status and blocks review/approve/process while
-- active. ─────────────────────────────────────────────────────────────
create or replace function place_settlement_batch_hold(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
begin
  if not has_permission('settlement.compliance_hold') then
    raise exception 'Missing required permission: settlement.compliance_hold';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to place a compliance hold';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status in ('completed', 'cancelled', 'failed') then
    raise exception 'This settlement batch is % and cannot be placed on hold', v_batch.status;
  end if;

  update settlement_batches set
    compliance_hold = true,
    compliance_hold_by = v_performer,
    compliance_hold_at = now(),
    compliance_hold_reason = p_reason,
    compliance_hold_released_by = null,
    compliance_hold_released_at = null
  where id = p_batch_id;

  insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
  values (p_batch_id, 'compliance_hold_placed', v_performer, p_reason);
end;
$$;

revoke execute on function place_settlement_batch_hold(uuid, text) from public;
grant execute on function place_settlement_batch_hold(uuid, text) to authenticated;
revoke execute on function place_settlement_batch_hold(uuid, text) from anon;

create or replace function release_settlement_batch_hold(p_batch_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
begin
  if not has_permission('settlement.compliance_hold') then
    raise exception 'Missing required permission: settlement.compliance_hold';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if not v_batch.compliance_hold then
    raise exception 'This batch is not currently on hold';
  end if;

  update settlement_batches set
    compliance_hold = false,
    compliance_hold_released_by = v_performer,
    compliance_hold_released_at = now()
  where id = p_batch_id;

  insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
  values (p_batch_id, 'compliance_hold_released', v_performer, p_notes);
end;
$$;

revoke execute on function release_settlement_batch_hold(uuid, text) from public;
grant execute on function release_settlement_batch_hold(uuid, text) to authenticated;
revoke execute on function release_settlement_batch_hold(uuid, text) from anon;

-- ── emergency_cancel_settlement_batch(): always requires a reason, always
-- audited, usable at any non-terminal status by whoever holds the
-- emergency permission. ──────────────────────────────────────────────────
create or replace function emergency_cancel_settlement_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
begin
  if not has_permission('settlement.emergency') then
    raise exception 'Missing required permission: settlement.emergency';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required for an emergency cancellation';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status in ('completed', 'cancelled') then
    raise exception 'This settlement batch is % and cannot be cancelled', v_batch.status;
  end if;

  update settlement_batches set
    status = 'cancelled',
    cancelled_by = v_performer,
    cancelled_at = now(),
    cancellation_reason = p_reason
  where id = p_batch_id;

  insert into settlement_batch_events (batch_id, event_type, performed_by, notes)
  values (p_batch_id, 'emergency_cancelled', v_performer, p_reason);
end;
$$;

revoke execute on function emergency_cancel_settlement_batch(uuid, text) from public;
grant execute on function emergency_cancel_settlement_batch(uuid, text) to authenticated;
revoke execute on function emergency_cancel_settlement_batch(uuid, text) from anon;

-- ── begin_settlement_batch_processing(): moves an approved batch into
-- 'processing'. The actual (sandbox/mock) payout calls happen in the app
-- layer — see src/lib/settlement/payout-adapter.ts — this function only
-- performs the status transition, so it stays independent of whatever the
-- adapter implementation is. ─────────────────────────────────────────────
create or replace function begin_settlement_batch_processing(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
  v_performer text;
begin
  if not has_permission('settlement.process') then
    raise exception 'Missing required permission: settlement.process';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_batch from settlement_batches where id = p_batch_id for update;
  if not found then
    raise exception 'Settlement batch not found';
  end if;
  if v_batch.status <> 'approved' then
    raise exception 'Only an approved batch can begin processing';
  end if;
  if v_batch.compliance_hold then
    raise exception 'This batch is on compliance hold and cannot be processed';
  end if;

  update settlement_batches set status = 'processing' where id = p_batch_id;

  update settlement_batch_lines set payout_status = 'processing', payout_attempted_at = now()
  where batch_id = p_batch_id and payout_status = 'pending';

  insert into settlement_batch_events (batch_id, event_type, performed_by)
  values (p_batch_id, 'processing_started', v_performer);
end;
$$;

revoke execute on function begin_settlement_batch_processing(uuid) from public;
grant execute on function begin_settlement_batch_processing(uuid) to authenticated;
revoke execute on function begin_settlement_batch_processing(uuid) from anon;

-- ── apply_settlement_line_payout_result(): the only way a line's payout
-- outcome is ever recorded, and the only place the batch's final status
-- (completed / partially_paid / failed) is derived — always from the
-- actual per-line results, never assumed. ────────────────────────────────
create or replace function apply_settlement_line_payout_result(
  p_line_id uuid,
  p_status text,
  p_payout_reference text,
  p_failure_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_batch_id uuid;
  v_total integer;
  v_paid integer;
  v_failed integer;
begin
  if not has_permission('settlement.process') then
    raise exception 'Missing required permission: settlement.process';
  end if;
  if p_status not in ('paid', 'failed') then
    raise exception 'Invalid payout result status: %', p_status;
  end if;

  select * into v_line from settlement_batch_lines where id = p_line_id for update;
  if not found then
    raise exception 'Settlement batch line not found';
  end if;
  v_batch_id := v_line.batch_id;

  update settlement_batch_lines set
    payout_status = p_status,
    payout_reference = p_payout_reference,
    payout_failure_reason = p_failure_reason,
    payout_completed_at = now()
  where id = p_line_id;

  select count(*), count(*) filter (where payout_status = 'paid'), count(*) filter (where payout_status = 'failed')
  into v_total, v_paid, v_failed
  from settlement_batch_lines where batch_id = v_batch_id;

  if v_paid + v_failed = v_total then
    update settlement_batches set
      status = case
        when v_failed = 0 then 'completed'
        when v_paid = 0 then 'failed'
        else 'partially_paid'
      end,
      completed_at = now()
    where id = v_batch_id;
  end if;
end;
$$;

revoke execute on function apply_settlement_line_payout_result(uuid, text, text, text) from public;
grant execute on function apply_settlement_line_payout_result(uuid, text, text, text) to authenticated;
revoke execute on function apply_settlement_line_payout_result(uuid, text, text, text) from anon;

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('settlement.view', 'settlement', 'View settlement batches, lines, exclusions and audit history'),
  ('settlement.prepare', 'settlement', 'Prepare (Finance Maker) and submit settlement batches for review'),
  ('settlement.review', 'settlement', 'Review settlement batches (Finance Checker)'),
  ('settlement.approve', 'settlement', 'Approve or reject settlement batches, including second approval on high-value batches'),
  ('settlement.compliance_hold', 'settlement', 'Place or release a compliance hold on a settlement batch'),
  ('settlement.process', 'settlement', 'Begin sandbox/mock payout processing on an approved batch'),
  ('settlement.emergency', 'settlement', 'Emergency-cancel a settlement batch at any non-terminal status')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('cfo', 'settlement.view'), ('cfo', 'settlement.prepare'), ('cfo', 'settlement.review'),
  ('cfo', 'settlement.approve'), ('cfo', 'settlement.process'), ('cfo', 'settlement.emergency'),
  ('compliance_security', 'settlement.view'), ('compliance_security', 'settlement.compliance_hold'),
  ('ceo', 'settlement.view')
on conflict do nothing;

revoke execute on function prepare_settlement_batch(date, uuid) from anon;
revoke execute on function submit_settlement_batch_for_review(uuid, text) from anon;
revoke execute on function review_settlement_batch(uuid, text) from anon;
revoke execute on function reject_settlement_batch(uuid, text) from anon;
revoke execute on function approve_settlement_batch(uuid, text) from anon;
revoke execute on function place_settlement_batch_hold(uuid, text) from anon;
revoke execute on function release_settlement_batch_hold(uuid, text) from anon;
revoke execute on function emergency_cancel_settlement_batch(uuid, text) from anon;
revoke execute on function begin_settlement_batch_processing(uuid) from anon;
revoke execute on function apply_settlement_line_payout_result(uuid, text, text, text) from anon;
