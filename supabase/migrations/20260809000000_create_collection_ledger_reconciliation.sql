-- Collection Ledger and Daily Reconciliation modules. No live provider API
-- integration exists anywhere in this migration or the app code that uses
-- it — every collection_transactions row comes from a CSV import (manual
-- import mode) or a clearly-labeled sandbox adapter that generates
-- synthetic rows for testing the pipeline. See
-- src/lib/collections/provider-adapter.ts for the interface a real
-- integration would eventually implement.
--
-- All monetary arithmetic that matters (net_merchant_amount, reconciliation
-- run totals, variance) is computed here in Postgres using exact numeric
-- arithmetic — never recomputed from JavaScript floating-point math. See
-- that file's header comment for the app-layer half of this rule.

-- ── collection_import_batches ───────────────────────────────────────────
create table if not exists collection_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_reference text not null,
  provider_name text not null default 'manual',
  mode text not null default 'manual_import' check (mode in ('manual_import', 'sandbox')),
  row_count integer not null default 0,
  imported_by text not null,
  imported_at timestamp with time zone not null default now(),
  notes text
);
alter table collection_import_batches enable row level security;

create policy "Staff can view import batches with permission"
  on collection_import_batches for select to authenticated
  using (has_permission('collections.view'));

create policy "Staff can insert import batches with permission"
  on collection_import_batches for insert to authenticated
  with check (has_permission('collections.manage'));

-- ── collection_transactions ─────────────────────────────────────────────
create table if not exists collection_transactions (
  id uuid primary key default gen_random_uuid(),
  provider_transaction_reference text not null,
  merchant_id uuid references merchants(id),
  till_reference text,
  payer_reference_masked text,

  -- All money columns are numeric(14,2) — exact decimal, never float8/real.
  gross_amount numeric(14, 2) not null check (gross_amount >= 0),
  currency text not null default 'TZS',
  provider_fee numeric(14, 2) not null default 0 check (provider_fee >= 0),
  bizlink_commission numeric(14, 2) not null default 0 check (bizlink_commission >= 0),
  other_authorised_adjustment numeric(14, 2) not null default 0,
  -- Generated (not app-computed): Postgres guarantees this is always
  -- exactly gross - fee - commission - adjustment, computed in exact
  -- decimal arithmetic, and it is structurally impossible for the app to
  -- write an inconsistent value here.
  net_merchant_amount numeric(14, 2) generated always as (
    gross_amount - provider_fee - bizlink_commission - other_authorised_adjustment
  ) stored,

  transaction_status text not null default 'pending' check (transaction_status in ('successful', 'failed', 'pending')),
  reconciliation_status text not null default 'unmatched' check (reconciliation_status in (
    'matched', 'partially_matched', 'unmatched', 'duplicate', 'reversed', 'under_review'
  )),
  -- Structural enforcement of "unreconciled/duplicate/reversed transactions
  -- cannot enter settlement" — not just an app-layer convention. Settlement
  -- eligibility can only ever be true for a matched, non-duplicate,
  -- non-reversed transaction.
  settlement_eligibility boolean not null default false,

  collected_at timestamp with time zone not null,
  imported_at timestamp with time zone not null default now(),
  source_file_reference text,
  import_batch_id uuid references collection_import_batches(id),

  reversal_status text not null default 'none' check (reversal_status in ('none', 'reversed', 'pending_reversal')),
  chargeback_status text not null default 'none' check (chargeback_status in ('none', 'disputed', 'chargeback_confirmed')),

  -- Duplicate reference detection: a duplicate is still inserted (visible,
  -- auditable) rather than silently rejected or dropped — it is simply
  -- never settlement-eligible, and points back at the original.
  duplicate_of_transaction_id uuid references collection_transactions(id),

  reconciliation_run_id uuid,

  created_by text not null,
  created_at timestamp with time zone not null default now()
);

alter table collection_transactions add constraint collection_transactions_settlement_eligibility_check check (
  settlement_eligibility = false or (
    reconciliation_status = 'matched'
    and transaction_status = 'successful'
    and reversal_status = 'none'
    and chargeback_status <> 'chargeback_confirmed'
    and duplicate_of_transaction_id is null
  )
);

alter table collection_transactions enable row level security;
create index if not exists collection_transactions_merchant_id_idx on collection_transactions (merchant_id);
create index if not exists collection_transactions_till_reference_idx on collection_transactions (till_reference);
create index if not exists collection_transactions_collected_at_idx on collection_transactions (collected_at);
create index if not exists collection_transactions_provider_reference_idx on collection_transactions (provider_transaction_reference);
create index if not exists collection_transactions_reconciliation_status_idx on collection_transactions (reconciliation_status);

create policy "Staff can view collection transactions with permission"
  on collection_transactions for select to authenticated
  using (has_permission('collections.view'));

create policy "Staff can insert collection transactions with permission"
  on collection_transactions for insert to authenticated
  with check (has_permission('collections.manage'));

create policy "Staff can update collection transactions with reconcile permission"
  on collection_transactions for update to authenticated
  using (has_permission('collections.reconcile') or has_permission('collections.approve'))
  with check (has_permission('collections.reconcile') or has_permission('collections.approve'));

-- ── collection_reconciliation_runs ──────────────────────────────────────
create table if not exists collection_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  from_date date not null,
  to_date date not null,
  till_reference text,
  merchant_id uuid references merchants(id),

  -- Manually entered by finance from the actual vendor/settlement account
  -- statement — there is no live vendor-account feed to pull this from.
  vendor_amount_received numeric(14, 2),

  -- Totals below are always populated from run_collection_reconciliation()
  -- (SQL SUM aggregates), never summed client-side.
  total_gross numeric(14, 2) not null default 0,
  total_provider_fees numeric(14, 2) not null default 0,
  total_bizlink_commission numeric(14, 2) not null default 0,
  total_net_merchant numeric(14, 2) not null default 0,
  total_reversals numeric(14, 2) not null default 0,
  total_chargebacks numeric(14, 2) not null default 0,
  matched_count integer not null default 0,
  unresolved_count integer not null default 0,
  variance numeric(14, 2) generated always as (
    coalesce(vendor_amount_received, 0) - total_net_merchant
  ) stored,

  status text not null default 'draft' check (status in ('draft', 'under_review', 'approved')),
  created_by text not null,
  created_at timestamp with time zone not null default now(),
  approved_by text,
  approved_at timestamp with time zone,
  approval_notes text
);
alter table collection_reconciliation_runs enable row level security;
create index if not exists collection_reconciliation_runs_date_idx on collection_reconciliation_runs (from_date, to_date);

alter table collection_transactions add constraint collection_transactions_reconciliation_run_fk
  foreign key (reconciliation_run_id) references collection_reconciliation_runs(id);

create policy "Staff can view reconciliation runs with permission"
  on collection_reconciliation_runs for select to authenticated
  using (has_permission('collections.view'));

create policy "Staff can insert reconciliation runs with permission"
  on collection_reconciliation_runs for insert to authenticated
  with check (has_permission('collections.reconcile'));

create policy "Staff can update reconciliation runs with approve permission"
  on collection_reconciliation_runs for update to authenticated
  using (has_permission('collections.approve'))
  with check (has_permission('collections.approve'));

-- Immutable reconciliation history: once a run is approved, it can never
-- be changed again (the row that performs the approval itself is allowed
-- through, since OLD.status is not yet 'approved' at that point).
create or replace function block_approved_reconciliation_run_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'approved' then
    raise exception 'This reconciliation run is approved and immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists collection_reconciliation_runs_immutable on collection_reconciliation_runs;
create trigger collection_reconciliation_runs_immutable
  before update on collection_reconciliation_runs
  for each row
  execute function block_approved_reconciliation_run_mutation();

-- ── collection_manual_adjustments ───────────────────────────────────────
create table if not exists collection_manual_adjustments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references collection_transactions(id),
  adjustment_amount numeric(14, 2) not null,
  reason text not null,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected')),
  requested_by text not null,
  requested_at timestamp with time zone not null default now(),
  approved_by text,
  approved_at timestamp with time zone,
  review_notes text
);
alter table collection_manual_adjustments enable row level security;
create index if not exists collection_manual_adjustments_transaction_id_idx on collection_manual_adjustments (transaction_id);

create policy "Staff can view manual adjustments with permission"
  on collection_manual_adjustments for select to authenticated
  using (has_permission('collections.view'));

create policy "Staff can request manual adjustments with permission"
  on collection_manual_adjustments for insert to authenticated
  with check (has_permission('collections.manage'));

create policy "Staff can review manual adjustments with approve permission"
  on collection_manual_adjustments for update to authenticated
  using (has_permission('collections.approve'))
  with check (has_permission('collections.approve'));

-- ── run_collection_reconciliation(): the only place aggregate totals and
-- per-transaction matching are computed — pure Postgres numeric SUM/CASE,
-- never JavaScript arithmetic. ─────────────────────────────────────────
create or replace function run_collection_reconciliation(
  p_from_date date,
  p_to_date date,
  p_till_reference text,
  p_merchant_id uuid,
  p_vendor_amount_received numeric,
  p_created_by text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  if not has_permission('collections.reconcile') then
    raise exception 'Missing required permission: collections.reconcile';
  end if;

  -- Deterministic matching rules (there is no live external system to
  -- match against yet — see the module's README comment in
  -- src/lib/collections/provider-adapter.ts): a reversed transaction is
  -- 'reversed'; a disputed (not yet confirmed) chargeback is held for
  -- 'under_review'; a transaction missing a resolved merchant/till is
  -- 'unmatched'; a resolved transaction with an unexpected currency or a
  -- zero amount is 'partially_matched'; everything else is 'matched'.
  -- Duplicates (flagged at import time) are left untouched here.
  update collection_transactions set
    reconciliation_status = case
      when reconciliation_status = 'duplicate' then 'duplicate'
      when reversal_status = 'reversed' then 'reversed'
      when chargeback_status = 'disputed' then 'under_review'
      when transaction_status = 'failed' then 'unmatched'
      when merchant_id is null or till_reference is null then 'unmatched'
      when gross_amount = 0 then 'partially_matched'
      else 'matched'
    end,
    reconciliation_run_id = null -- set below, after the run row exists
  where collected_at::date between p_from_date and p_to_date
    and (p_till_reference is null or till_reference = p_till_reference)
    and (p_merchant_id is null or merchant_id = p_merchant_id);

  insert into collection_reconciliation_runs (
    from_date, to_date, till_reference, merchant_id, vendor_amount_received,
    total_gross, total_provider_fees, total_bizlink_commission, total_net_merchant,
    total_reversals, total_chargebacks, matched_count, unresolved_count,
    created_by
  )
  select
    p_from_date, p_to_date, p_till_reference, p_merchant_id, p_vendor_amount_received,
    coalesce(sum(gross_amount), 0),
    coalesce(sum(provider_fee), 0),
    coalesce(sum(bizlink_commission), 0),
    coalesce(sum(net_merchant_amount) filter (where reconciliation_status = 'matched'), 0),
    coalesce(sum(gross_amount) filter (where reversal_status = 'reversed'), 0),
    coalesce(sum(gross_amount) filter (where chargeback_status in ('disputed', 'chargeback_confirmed')), 0),
    count(*) filter (where reconciliation_status = 'matched'),
    count(*) filter (where reconciliation_status in ('unmatched', 'partially_matched', 'under_review', 'duplicate')),
    p_created_by
  from collection_transactions
  where collected_at::date between p_from_date and p_to_date
    and (p_till_reference is null or till_reference = p_till_reference)
    and (p_merchant_id is null or merchant_id = p_merchant_id)
  returning id into v_run_id;

  update collection_transactions set reconciliation_run_id = v_run_id
  where collected_at::date between p_from_date and p_to_date
    and (p_till_reference is null or till_reference = p_till_reference)
    and (p_merchant_id is null or merchant_id = p_merchant_id);

  return v_run_id;
end;
$$;

revoke execute on function run_collection_reconciliation(date, date, text, uuid, numeric, text) from public;
grant execute on function run_collection_reconciliation(date, date, text, uuid, numeric, text) to authenticated;

-- ── approve_collection_reconciliation_run(): the only way settlement_eligibility ever becomes true ──
create or replace function approve_collection_reconciliation_run(
  p_run_id uuid,
  p_approval_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run record;
begin
  if not has_permission('collections.approve') then
    raise exception 'Missing required permission: collections.approve';
  end if;

  select * into v_run from collection_reconciliation_runs where id = p_run_id for update;
  if not found then
    raise exception 'Reconciliation run not found';
  end if;
  if v_run.status = 'approved' then
    raise exception 'This reconciliation run has already been approved';
  end if;

  update collection_reconciliation_runs set
    status = 'approved',
    approved_by = coalesce((select email from auth.users where id = auth.uid()), 'unknown'),
    approved_at = now(),
    approval_notes = p_approval_notes
  where id = p_run_id;

  -- Only matched, non-reversed, non-charged-back, non-duplicate
  -- transactions in this run become settlement-eligible — the CHECK
  -- constraint on collection_transactions would reject any other
  -- combination anyway, but this WHERE clause keeps it explicit.
  update collection_transactions set settlement_eligibility = true
  where reconciliation_run_id = p_run_id
    and reconciliation_status = 'matched'
    and transaction_status = 'successful'
    and reversal_status = 'none'
    and chargeback_status <> 'chargeback_confirmed'
    and duplicate_of_transaction_id is null;
end;
$$;

revoke execute on function approve_collection_reconciliation_run(uuid, text) from public;
grant execute on function approve_collection_reconciliation_run(uuid, text) to authenticated;

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('collections.view', 'collections', 'View collection ledger and reconciliation runs'),
  ('collections.manage', 'collections', 'Import collection statements and request manual adjustments'),
  ('collections.reconcile', 'collections', 'Run daily reconciliation'),
  ('collections.approve', 'collections', 'Approve reconciliation runs and manual adjustments')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('cfo', 'collections.view'), ('cfo', 'collections.manage'), ('cfo', 'collections.reconcile'), ('cfo', 'collections.approve'),
  ('operations', 'collections.view'), ('operations', 'collections.manage'),
  ('compliance_security', 'collections.view'),
  ('ceo', 'collections.view')
on conflict do nothing;

-- Postgres grants EXECUTE on a new function to PUBLIC (including anon) by
-- default; each function above already refuses to do anything for a caller
-- has_permission() rejects, but there is no reason to leave the RPC
-- endpoint invokable by anon at all (see the identical comment in
-- 20260808000000's beneficiary functions).
revoke execute on function run_collection_reconciliation(date, date, text, uuid, numeric, text) from anon;
revoke execute on function approve_collection_reconciliation_run(uuid, text) from anon;
