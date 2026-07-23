-- Extends contracts with merchant/agent onboarding fields. Deliberately
-- split into two tiers:
--
--   1. Safe business/contact/location profile fields — added directly to
--      `contracts`, visible to anyone with contracts.view (same as today).
--
--   2. Sensitive KYC/banking fields (TIN, NIDA national ID, bank account
--      details, transaction volumes) — moved to a SEPARATE table with its
--      own permission gate. This is a real requirement, not just UI
--      hiding: Postgres RLS is row-level, not column-level, so there is no
--      way to let someone read a contracts row while hiding just some of
--      its columns. A separate table is the only way to make "can see the
--      contract" and "can see its banking/national-ID details" genuinely
--      independent, enforceable at the database layer.
--
-- No payment-partner name appears anywhere in this schema — kept
-- provider-neutral per the site's compliance rules.

-- ============================================================
-- 1. Safe fields on contracts
-- ============================================================

alter table contracts add column if not exists outlet_name text;
alter table contracts add column if not exists business_name text;
alter table contracts add column if not exists address text;
alter table contracts add column if not exists city text;
alter table contracts add column if not exists district text;
alter table contracts add column if not exists ward text;
alter table contracts add column if not exists region text;
alter table contracts add column if not exists gps_latitude numeric(9,6);
alter table contracts add column if not exists gps_longitude numeric(9,6);
alter table contracts add column if not exists contact_name text;
alter table contracts add column if not exists contact_designation text;
alter table contracts add column if not exists contact_phone text;
alter table contracts add column if not exists contact_email text;
alter table contracts add column if not exists notification_phone text;
alter table contracts add column if not exists notification_email text;
alter table contracts add column if not exists business_type text;
alter table contracts add column if not exists year_of_incorporation int;
alter table contracts add column if not exists years_of_operation int;

-- ============================================================
-- 2. New permissions for the sensitive tier
-- ============================================================

insert into permissions (id, module, description) values
  ('contracts.sensitive.view', 'contracts', 'View merchant KYC/banking details (TIN, NIDA, bank account, transaction volumes)'),
  ('contracts.sensitive.manage', 'contracts', 'Add/edit merchant KYC/banking details')
on conflict (id) do nothing;

-- view: Compliance & Security (natural KYC owner), CFO (banking reconciliation),
-- CEO (oversight). manage: Compliance & Security only — collecting this data
-- is a compliance function, not a general Operations one.
insert into role_permissions (role_id, permission_id) values
  ('compliance_security', 'contracts.sensitive.view'), ('compliance_security', 'contracts.sensitive.manage'),
  ('cfo', 'contracts.sensitive.view'),
  ('ceo', 'contracts.sensitive.view')
on conflict do nothing;

-- ============================================================
-- 3. Sensitive details table
-- ============================================================

create table if not exists contract_sensitive_details (
  contract_id uuid primary key references contracts(id) on delete cascade,

  tin text,
  tin_registration_date date,
  nida text,

  monthly_turnover numeric(14,2),
  daily_cash_collection numeric(14,2),
  uses_mobile_money boolean not null default false,
  daily_mobile_money_collection numeric(14,2),
  uses_pos boolean not null default false,
  daily_pos_collection numeric(14,2),
  international_card_acceptance_reason text,

  bank_name text,
  bank_branch text,
  bank_account_name text,
  bank_account_number text,

  updated_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create trigger contract_sensitive_details_set_updated_at
  before update on contract_sensitive_details
  for each row
  execute function set_updated_at();

alter table contract_sensitive_details enable row level security;

create policy "contracts.sensitive.view can select sensitive details"
  on contract_sensitive_details for select to authenticated
  using (has_permission('contracts.sensitive.view'));

create policy "contracts.sensitive.manage can insert sensitive details"
  on contract_sensitive_details for insert to authenticated
  with check (has_permission('contracts.sensitive.manage'));

create policy "contracts.sensitive.manage can update sensitive details"
  on contract_sensitive_details for update to authenticated
  using (has_permission('contracts.sensitive.manage'))
  with check (has_permission('contracts.sensitive.manage'));
