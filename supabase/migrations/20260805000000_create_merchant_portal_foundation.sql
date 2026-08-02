-- Foundation for the merchant-facing onboarding portal (/merchant/*).
-- Merchants are a distinct class of Supabase Auth user from BizLink staff:
-- a merchant_users row links exactly one auth.users account to exactly one
-- merchant, which is what makes "no acceptance on behalf of another
-- merchant" a structural guarantee rather than an app-layer promise — a
-- signed-in merchant user has one, and only one, merchant_id, and every
-- policy below derives it from auth.uid() server-side, never from
-- client-submitted input.
--
-- Merchant accounts are provisioned by BizLink staff (service-role only —
-- there is no public self-registration insert policy on merchants or
-- merchant_users, intentionally).

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table merchants enable row level security;

drop trigger if exists merchants_set_updated_at on merchants;
create trigger merchants_set_updated_at
  before update on merchants
  for each row
  execute function set_updated_at();

create table if not exists merchant_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  merchant_id uuid not null references merchants(id) on delete cascade,
  full_name text not null,
  role text not null default 'representative',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);
alter table merchant_users enable row level security;
create index if not exists merchant_users_merchant_id_idx on merchant_users (merchant_id);

-- Append-only digital acknowledgement record. This is NOT a substitute for
-- the signed merchant agreement — it records the digital acknowledgement
-- captured during onboarding.
create table if not exists merchant_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  terms_version text not null,
  privacy_version text not null,
  accepted_by_name text not null,
  accepted_by_user_id uuid not null references auth.users(id),
  accepted_at timestamp with time zone not null default now(),
  ip_address text,
  user_agent text,
  acknowledgements jsonb not null,
  document_hash text,
  created_at timestamp with time zone not null default now()
);
alter table merchant_terms_acceptances enable row level security;
create index if not exists merchant_terms_acceptances_merchant_id_idx on merchant_terms_acceptances (merchant_id);

-- ── merchants ──────────────────────────────────────────────────────────
create policy "Merchant can view own merchant record"
  on merchants for select to authenticated
  using (id in (select merchant_id from merchant_users where user_id = auth.uid()));

create policy "Staff can view merchants"
  on merchants for select to authenticated
  using (is_active_staff());

-- ── merchant_users ─────────────────────────────────────────────────────
create policy "Merchant can view own profile"
  on merchant_users for select to authenticated
  using (user_id = auth.uid());

create policy "Staff can view merchant_users"
  on merchant_users for select to authenticated
  using (is_active_staff());

-- ── merchant_terms_acceptances ────────────────────────────────────────
create policy "Merchant can view own terms acceptances"
  on merchant_terms_acceptances for select to authenticated
  using (merchant_id in (select merchant_id from merchant_users where user_id = auth.uid()));

create policy "Staff can view merchant_terms_acceptances"
  on merchant_terms_acceptances for select to authenticated
  using (is_active_staff());

-- The only way this table can ever be written by a merchant: the caller
-- must be an active representative of the exact merchant being accepted
-- for, and must be recording their own acceptance (accepted_by_user_id).
-- Both are re-derived and checked here independently of whatever the
-- server action already validated.
create policy "Merchant can accept terms for their own merchant only"
  on merchant_terms_acceptances for insert to authenticated
  with check (
    accepted_by_user_id = auth.uid()
    and merchant_id in (
      select merchant_id from merchant_users where user_id = auth.uid() and is_active = true
    )
  );

-- Deliberately no update/delete policy for anyone — append-only. The
-- trigger below backs this up even against direct service-role/SQL access.
create or replace function prevent_terms_acceptance_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'merchant_terms_acceptances is append-only and cannot be updated or deleted';
end;
$$;

drop trigger if exists merchant_terms_acceptances_block_update on merchant_terms_acceptances;
create trigger merchant_terms_acceptances_block_update
  before update on merchant_terms_acceptances
  for each row
  execute function prevent_terms_acceptance_mutation();

drop trigger if exists merchant_terms_acceptances_block_delete on merchant_terms_acceptances;
create trigger merchant_terms_acceptances_block_delete
  before delete on merchant_terms_acceptances
  for each row
  execute function prevent_terms_acceptance_mutation();
