-- Commission & Fee Rules module. Super Admin / authorised Finance only —
-- gated end-to-end by commission_rules.view / .manage / .approve, granted
-- only to super_admin and cfo (see grants at the bottom of this file).
--
-- Versioning: a rate change is never an UPDATE to an existing rule's rate
-- fields — it is a brand-new row (a new version). Once a rule reaches
-- 'approved', a trigger freezes every rate/scope column forever, so a
-- transaction that stored commission_rule_id can never have its historical
-- calculation silently change underneath it. The only mutation an approved
-- row can ever undergo is the single approved -> expired transition (via
-- expire_commission_fee_rule), and even then only expiry_date/expiry_reason
-- change — never the rate itself.
--
-- Overlap prevention is structural, not app-layer: an EXCLUDE constraint
-- (via btree_gist) rejects any INSERT/UPDATE that would create two
-- 'approved', non-allow_overlap rules with overlapping date ranges for the
-- same merchant/service scope.
--
-- All rate/fee columns are numeric — never float8/real — matching the
-- convention established in collection_ledger_reconciliation. The
-- TypeScript calculation engine (src/lib/commission/calculate.ts) mirrors
-- this: it does exact BigInt minor-unit arithmetic and never touches
-- Number()/parseFloat() on a money or percentage value.

create extension if not exists btree_gist with schema extensions;

-- ── commission_fee_rules ─────────────────────────────────────────────────
create table if not exists commission_fee_rules (
  id uuid primary key default gen_random_uuid(),

  -- Versioning lineage: all versions of "the same" rule share rule_group_id.
  rule_group_id uuid not null default gen_random_uuid(),
  version_number integer not null default 1 check (version_number >= 1),
  previous_version_id uuid references commission_fee_rules(id),

  commission_type text not null check (commission_type in ('percentage', 'fixed', 'tiered')),
  percentage_rate numeric(7, 4) check (percentage_rate is null or (percentage_rate >= 0 and percentage_rate <= 100)),
  fixed_fee_amount numeric(14, 2) check (fixed_fee_amount is null or fixed_fee_amount >= 0),
  minimum_fee numeric(14, 2) check (minimum_fee is null or minimum_fee >= 0),
  maximum_fee numeric(14, 2) check (maximum_fee is null or maximum_fee >= 0),
  settlement_fee numeric(14, 2) not null default 0 check (settlement_fee >= 0),
  monthly_technology_fee numeric(14, 2) not null default 0 check (monthly_technology_fee >= 0),
  currency text not null default 'TZS',

  check (
    (commission_type = 'percentage' and percentage_rate is not null)
    or (commission_type = 'fixed' and fixed_fee_amount is not null)
    or (commission_type = 'tiered')
  ),
  check (maximum_fee is null or minimum_fee is null or maximum_fee >= minimum_fee),

  effective_date date not null,
  expiry_date date,
  check (expiry_date is null or expiry_date >= effective_date),

  -- Scope: null merchant_id/service_key = applies to all merchants/services
  -- respectively (a default/global rule). See src/lib/commission/resolve.ts
  -- for the specificity ordering used to pick a winner when several rules
  -- could apply.
  merchant_id uuid references merchants(id),
  service_key text,
  contract_id uuid references contracts(id),
  allow_overlap boolean not null default false,

  -- Used only by the EXCLUDE constraint below to scope "same merchant/service".
  overlap_key text generated always as (
    coalesce(merchant_id::text, 'ALL') || '|' || coalesce(service_key, 'ALL')
  ) stored,

  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'expired')),
  change_reason text not null check (length(trim(change_reason)) > 0),

  created_by text not null,
  created_at timestamp with time zone not null default now(),

  reviewed_by text,
  reviewed_at timestamp with time zone,
  review_notes text,

  approved_by text,
  approved_at timestamp with time zone,

  expired_by text,
  expired_at timestamp with time zone,
  expiry_reason text
);

alter table commission_fee_rules enable row level security;

create index if not exists commission_fee_rules_rule_group_id_idx on commission_fee_rules (rule_group_id);
create index if not exists commission_fee_rules_merchant_id_idx on commission_fee_rules (merchant_id);
create index if not exists commission_fee_rules_service_key_idx on commission_fee_rules (service_key);
create index if not exists commission_fee_rules_status_idx on commission_fee_rules (status);
create index if not exists commission_fee_rules_lookup_idx
  on commission_fee_rules (merchant_id, service_key, status, effective_date);

-- Structural overlap prevention: two 'approved', non-allow_overlap rules for
-- the same merchant/service scope can never have overlapping active windows.
alter table commission_fee_rules add constraint commission_fee_rules_no_overlap
  exclude using gist (
    overlap_key with =,
    daterange(effective_date, coalesce(expiry_date, 'infinity'::date), '[]') with &&
  ) where (status = 'approved' and allow_overlap = false);

create policy "Staff can view commission fee rules with permission"
  on commission_fee_rules for select to authenticated
  using (has_permission('commission_rules.view'));

create policy "Staff can insert draft commission fee rules with permission"
  on commission_fee_rules for insert to authenticated
  with check (has_permission('commission_rules.manage') and status = 'draft');

create policy "Staff can edit draft commission fee rules with permission"
  on commission_fee_rules for update to authenticated
  using (has_permission('commission_rules.manage') and status = 'draft')
  with check (has_permission('commission_rules.manage') and status = 'draft');

-- No delete policy at all: rules are never deleted, only rejected/expired.
-- No update policy for non-draft rows: every other transition (submit,
-- approve, reject, expire) goes exclusively through the SECURITY DEFINER
-- functions below.

-- Immutability: freeze rate/scope fields once submitted; freeze everything
-- once rejected/expired; approved may only ever move to expired.
create or replace function block_immutable_commission_rule_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_core_changed boolean;
begin
  v_core_changed := (
    new.commission_type is distinct from old.commission_type
    or new.percentage_rate is distinct from old.percentage_rate
    or new.fixed_fee_amount is distinct from old.fixed_fee_amount
    or new.minimum_fee is distinct from old.minimum_fee
    or new.maximum_fee is distinct from old.maximum_fee
    or new.settlement_fee is distinct from old.settlement_fee
    or new.monthly_technology_fee is distinct from old.monthly_technology_fee
    or new.currency is distinct from old.currency
    or new.effective_date is distinct from old.effective_date
    or new.merchant_id is distinct from old.merchant_id
    or new.service_key is distinct from old.service_key
    or new.contract_id is distinct from old.contract_id
  );

  if old.status in ('pending_approval', 'approved') and v_core_changed then
    raise exception 'Rate terms are locked once this rule is submitted for approval. Create a new rule version instead.';
  end if;

  if old.status in ('rejected', 'expired') then
    raise exception 'This commission rule is % and immutable.', old.status;
  end if;

  if old.status = 'approved' and new.status is distinct from old.status and new.status is distinct from 'expired' then
    raise exception 'An approved commission rule can only ever transition to expired.';
  end if;

  return new;
end;
$$;

drop trigger if exists commission_fee_rules_immutable on commission_fee_rules;
create trigger commission_fee_rules_immutable
  before update on commission_fee_rules
  for each row
  execute function block_immutable_commission_rule_mutation();

-- ── commission_fee_rule_tiers ────────────────────────────────────────────
create table if not exists commission_fee_rule_tiers (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references commission_fee_rules(id) on delete cascade,
  tier_order integer not null check (tier_order >= 0),
  min_amount numeric(14, 2) not null check (min_amount >= 0),
  max_amount numeric(14, 2) check (max_amount is null or max_amount > min_amount),
  tier_percentage numeric(7, 4) not null check (tier_percentage >= 0 and tier_percentage <= 100),
  unique (rule_id, tier_order)
);

alter table commission_fee_rule_tiers enable row level security;
create index if not exists commission_fee_rule_tiers_rule_id_idx on commission_fee_rule_tiers (rule_id);

create policy "Staff can view commission fee rule tiers with permission"
  on commission_fee_rule_tiers for select to authenticated
  using (has_permission('commission_rules.view'));

create policy "Staff can manage commission fee rule tiers with permission"
  on commission_fee_rule_tiers for all to authenticated
  using (has_permission('commission_rules.manage'))
  with check (has_permission('commission_rules.manage'));

-- Tiers may only be added/changed/removed while the parent rule is still a
-- draft — once submitted, the tier set is frozen along with everything else.
create or replace function block_tier_mutation_after_draft()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_rule_id uuid;
begin
  v_rule_id := coalesce(new.rule_id, old.rule_id);
  select status into v_status from commission_fee_rules where id = v_rule_id;
  if v_status is distinct from 'draft' then
    raise exception 'Commission rule tiers can only be changed while the parent rule is in draft status.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists commission_fee_rule_tiers_immutable on commission_fee_rule_tiers;
create trigger commission_fee_rule_tiers_immutable
  before insert or update or delete on commission_fee_rule_tiers
  for each row
  execute function block_tier_mutation_after_draft();

-- ── validate_commission_fee_rule_tiers(): tiers must be contiguous and
-- gap-free (tier N's max_amount must equal tier N+1's min_amount). ───────
create or replace function validate_commission_fee_rule_tiers(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission_type text;
  v_tier_count integer;
  v_prev_max numeric;
  v_row record;
begin
  select commission_type into v_commission_type from commission_fee_rules where id = p_rule_id;
  if v_commission_type is distinct from 'tiered' then
    return;
  end if;

  select count(*) into v_tier_count from commission_fee_rule_tiers where rule_id = p_rule_id;
  if v_tier_count = 0 then
    raise exception 'A tiered commission rule requires at least one tier';
  end if;

  v_prev_max := null;
  for v_row in select * from commission_fee_rule_tiers where rule_id = p_rule_id order by tier_order asc loop
    if v_prev_max is not null and v_row.min_amount is distinct from v_prev_max then
      raise exception 'Tier % must start exactly where the previous tier ends (expected %, got %)',
        v_row.tier_order, v_prev_max, v_row.min_amount;
    end if;
    v_prev_max := v_row.max_amount;
  end loop;
end;
$$;

revoke execute on function validate_commission_fee_rule_tiers(uuid) from public;
grant execute on function validate_commission_fee_rule_tiers(uuid) to authenticated;
revoke execute on function validate_commission_fee_rule_tiers(uuid) from anon;

-- ── submit_commission_fee_rule_for_approval() ────────────────────────────
create or replace function submit_commission_fee_rule_for_approval(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
begin
  if not has_permission('commission_rules.manage') then
    raise exception 'Missing required permission: commission_rules.manage';
  end if;

  select * into v_rule from commission_fee_rules where id = p_rule_id for update;
  if not found then
    raise exception 'Commission rule not found';
  end if;
  if v_rule.status <> 'draft' then
    raise exception 'Only a draft rule can be submitted for approval';
  end if;

  perform validate_commission_fee_rule_tiers(p_rule_id);

  update commission_fee_rules set status = 'pending_approval' where id = p_rule_id;
end;
$$;

revoke execute on function submit_commission_fee_rule_for_approval(uuid) from public;
grant execute on function submit_commission_fee_rule_for_approval(uuid) to authenticated;
revoke execute on function submit_commission_fee_rule_for_approval(uuid) from anon;

-- ── approve_commission_fee_rule(): maker-checker enforced by identity,
-- not merely by permission — the approver must differ from the requester. ─
create or replace function approve_commission_fee_rule(p_rule_id uuid, p_approval_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_performer text;
begin
  if not has_permission('commission_rules.approve') then
    raise exception 'Missing required permission: commission_rules.approve';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_rule from commission_fee_rules where id = p_rule_id for update;
  if not found then
    raise exception 'Commission rule not found';
  end if;
  if v_rule.status <> 'pending_approval' then
    raise exception 'Only a rule pending approval can be approved';
  end if;
  if v_rule.created_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from the requester';
  end if;

  perform validate_commission_fee_rule_tiers(p_rule_id);

  update commission_fee_rules set
    status = 'approved',
    approved_by = v_performer,
    approved_at = now(),
    reviewed_by = v_performer,
    reviewed_at = now(),
    review_notes = p_approval_notes
  where id = p_rule_id;
end;
$$;

revoke execute on function approve_commission_fee_rule(uuid, text) from public;
grant execute on function approve_commission_fee_rule(uuid, text) to authenticated;
revoke execute on function approve_commission_fee_rule(uuid, text) from anon;

-- ── reject_commission_fee_rule() ─────────────────────────────────────────
create or replace function reject_commission_fee_rule(p_rule_id uuid, p_review_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_performer text;
begin
  if not has_permission('commission_rules.approve') then
    raise exception 'Missing required permission: commission_rules.approve';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_rule from commission_fee_rules where id = p_rule_id for update;
  if not found then
    raise exception 'Commission rule not found';
  end if;
  if v_rule.status <> 'pending_approval' then
    raise exception 'Only a rule pending approval can be rejected';
  end if;
  if v_rule.created_by = v_performer then
    raise exception 'Maker-checker violation: the reviewer must be different from the requester';
  end if;
  if p_review_notes is null or length(trim(p_review_notes)) = 0 then
    raise exception 'A reason is required to reject a commission rule';
  end if;

  update commission_fee_rules set
    status = 'rejected',
    reviewed_by = v_performer,
    reviewed_at = now(),
    review_notes = p_review_notes
  where id = p_rule_id;
end;
$$;

revoke execute on function reject_commission_fee_rule(uuid, text) from public;
grant execute on function reject_commission_fee_rule(uuid, text) to authenticated;
revoke execute on function reject_commission_fee_rule(uuid, text) from anon;

-- ── expire_commission_fee_rule(): the only way to end an approved rule's
-- active window early. Rate/scope fields remain frozen (see the immutable
-- trigger above) — only expiry_date/expiry_reason/status change. ─────────
create or replace function expire_commission_fee_rule(p_rule_id uuid, p_expiry_date date, p_expiry_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_performer text;
begin
  if not has_permission('commission_rules.approve') then
    raise exception 'Missing required permission: commission_rules.approve';
  end if;
  if p_expiry_reason is null or length(trim(p_expiry_reason)) = 0 then
    raise exception 'A reason is required to expire a commission rule';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_rule from commission_fee_rules where id = p_rule_id for update;
  if not found then
    raise exception 'Commission rule not found';
  end if;
  if v_rule.status <> 'approved' then
    raise exception 'Only an approved rule can be expired';
  end if;
  if p_expiry_date < v_rule.effective_date then
    raise exception 'Expiry date cannot be before the effective date';
  end if;

  update commission_fee_rules set
    status = 'expired',
    expiry_date = p_expiry_date,
    expired_by = v_performer,
    expired_at = now(),
    expiry_reason = p_expiry_reason
  where id = p_rule_id;
end;
$$;

revoke execute on function expire_commission_fee_rule(uuid, date, text) from public;
grant execute on function expire_commission_fee_rule(uuid, date, text) to authenticated;
revoke execute on function expire_commission_fee_rule(uuid, date, text) from anon;

-- ── Commission Ledger linkage ────────────────────────────────────────────
-- Nullable, additive: pins the exact rule version applied to a collection
-- transaction so a later rate change can never change a historical
-- calculation. Existing collection tooling does not yet auto-populate this
-- (no automatic rule application has been wired into the import pipeline);
-- it is exposed here so that capability can be added without a schema
-- change, and so a Calculation Preview or future settlement job has a real
-- column to write into.
alter table collection_transactions
  add column if not exists commission_rule_id uuid references commission_fee_rules(id),
  add column if not exists commission_rule_version integer;

create index if not exists collection_transactions_commission_rule_id_idx
  on collection_transactions (commission_rule_id);

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('commission_rules.view', 'commission_rules', 'View commission and fee rules, calculation previews and merchant rate history'),
  ('commission_rules.manage', 'commission_rules', 'Create and edit draft commission and fee rules'),
  ('commission_rules.approve', 'commission_rules', 'Approve, reject and expire commission and fee rules')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

-- Deliberately restricted to Finance (cfo) only, per "Super Admin/authorised
-- Finance only" — no other role (operations, compliance_security, ceo,
-- customer_support, auditor, cto, marketing) is granted access to this
-- module.
insert into role_permissions (role_id, permission_id) values
  ('cfo', 'commission_rules.view'), ('cfo', 'commission_rules.manage'), ('cfo', 'commission_rules.approve')
on conflict do nothing;

-- Postgres grants EXECUTE on a new function to PUBLIC (including anon) by
-- default; every function here already refuses to do anything for a caller
-- has_permission() rejects, but there is no reason to leave any of these
-- RPC endpoints invokable by anon at all.
revoke execute on function validate_commission_fee_rule_tiers(uuid) from anon;
revoke execute on function submit_commission_fee_rule_for_approval(uuid) from anon;
revoke execute on function approve_commission_fee_rule(uuid, text) from anon;
revoke execute on function reject_commission_fee_rule(uuid, text) from anon;
revoke execute on function expire_commission_fee_rule(uuid, date, text) from anon;
