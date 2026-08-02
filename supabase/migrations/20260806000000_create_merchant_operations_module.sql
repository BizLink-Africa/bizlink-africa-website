-- Merchant Operations admin module: extends the merchants table (created in
-- 20260805000000_create_merchant_portal_foundation.sql for the merchant
-- portal's own auth) with full staff-facing profile/workflow fields, plus 5
-- new tables backing the "Merchant Applications", "Merchant Profiles", "KYC
-- Coordination", "Merchant Tills", and "Settlement Beneficiaries" sidebar
-- pages.
--
-- Important: BizLink coordinates KYC but never decides it. merchant_kyc_reviews
-- records what was submitted to the approved payment infrastructure partner
-- and what the partner reported back — partner_decision is always a fact
-- being RECORDED, never a decision this app makes. Confidential partner
-- credentials and negotiated rates are never modeled here at all — there is
-- no column anywhere in this migration for either.

-- ── merchants: staff-facing profile fields ──────────────────────────────
-- merchants.status (pending/active/suspended, from the portal-auth
-- migration) is left untouched for backward compatibility but is not read
-- by any Merchant Operations code below — onboarding_status is the
-- authoritative workflow field for staff-facing operations.
alter table merchants
  add column if not exists trading_name text,
  add column if not exists registration_type text,
  add column if not exists tin text,
  add column if not exists licence_number text,
  add column if not exists business_category text,
  add column if not exists contact_person_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists business_address text,
  add column if not exists expected_volume text,
  add column if not exists risk_status text not null default 'medium',
  add column if not exists onboarding_status text not null default 'application_received',
  add column if not exists partner_merchant_reference text,
  add column if not exists till_reference text,
  add column if not exists settlement_status text not null default 'not_started',
  add column if not exists assigned_staff_id uuid references staff_profiles(id),
  add column if not exists compliance_hold boolean not null default false,
  add column if not exists compliance_hold_reason text;

alter table merchants drop constraint if exists merchants_onboarding_status_check;
alter table merchants add constraint merchants_onboarding_status_check check (onboarding_status in (
  'application_received', 'pre_screening', 'documents_incomplete', 'submitted_to_partner',
  'kyc_under_review', 'additional_information_required', 'kyc_approved', 'till_created',
  'settlement_setup_pending', 'active', 'rejected', 'suspended'
));

alter table merchants drop constraint if exists merchants_risk_status_check;
alter table merchants add constraint merchants_risk_status_check check (risk_status in ('low', 'medium', 'high'));

alter table merchants drop constraint if exists merchants_settlement_status_check;
alter table merchants add constraint merchants_settlement_status_check check (settlement_status in (
  'not_started', 'pending_verification', 'verified', 'active', 'held'
));

alter table merchants drop constraint if exists merchants_registration_type_check;
alter table merchants add constraint merchants_registration_type_check check (
  registration_type is null or registration_type in ('sole_proprietor', 'limited_company', 'partnership', 'ngo', 'other')
);

create index if not exists merchants_onboarding_status_idx on merchants (onboarding_status);
create index if not exists merchants_assigned_staff_id_idx on merchants (assigned_staff_id);

-- Staff can view/manage the merchants table directly (separate from the
-- merchant-portal policies already on this table from the prior migration,
-- which only ever grant a merchant their OWN row).
create policy "Staff can view merchants with permission"
  on merchants for select to authenticated
  using (has_permission('merchants.view'));

create policy "Staff can update merchants with permission"
  on merchants for update to authenticated
  using (has_permission('merchants.manage'))
  with check (has_permission('merchants.manage'));

create policy "Staff can insert merchants with permission"
  on merchants for insert to authenticated
  with check (has_permission('merchants.manage'));

-- ── merchant_status_history: append-only, one row per onboarding_status change ──
create table if not exists merchant_status_history (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  from_status text,
  to_status text not null,
  note text,
  changed_by text not null,
  changed_at timestamp with time zone not null default now()
);
alter table merchant_status_history enable row level security;
create index if not exists merchant_status_history_merchant_id_idx on merchant_status_history (merchant_id);

create policy "Staff can view merchant status history"
  on merchant_status_history for select to authenticated
  using (has_permission('merchants.view'));

create policy "Staff can insert merchant status history"
  on merchant_status_history for insert to authenticated
  with check (has_permission('merchants.manage'));
-- Deliberately no update/delete policy — append-only status trail.

-- ── merchant_notes: internal notes ──────────────────────────────────────
create table if not exists merchant_notes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  note text not null,
  created_by text not null,
  created_at timestamp with time zone not null default now()
);
alter table merchant_notes enable row level security;
create index if not exists merchant_notes_merchant_id_idx on merchant_notes (merchant_id);

create policy "Staff can view merchant notes"
  on merchant_notes for select to authenticated
  using (has_permission('merchants.view'));

create policy "Staff can insert merchant notes"
  on merchant_notes for insert to authenticated
  with check (has_permission('merchants.manage'));

-- ── merchant_documents: onboarding document checklist (status tracking only — no file storage/upload) ──
create table if not exists merchant_documents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  document_type text not null,
  status text not null default 'pending' check (status in ('pending', 'received', 'verified', 'rejected')),
  notes text,
  updated_by text,
  updated_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  unique (merchant_id, document_type)
);
alter table merchant_documents enable row level security;
create index if not exists merchant_documents_merchant_id_idx on merchant_documents (merchant_id);

create policy "Staff can view merchant documents"
  on merchant_documents for select to authenticated
  using (has_permission('merchants.view'));

create policy "Staff can manage merchant documents"
  on merchant_documents for all to authenticated
  using (has_permission('merchants.manage'))
  with check (has_permission('merchants.manage'));

-- ── merchant_kyc_reviews: log of coordination with the approved payment infrastructure partner ──
-- partner_decision RECORDS what the partner reported back. BizLink never
-- sets this to 'approved' on its own authority — the action layer only
-- ever writes what a staff member is transcribing from the partner's
-- response.
create table if not exists merchant_kyc_reviews (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  stage text not null check (stage in ('submitted_to_partner', 'partner_response_received')),
  partner_decision text check (partner_decision in ('pending', 'approved', 'rejected', 'additional_information_required')),
  partner_reference text,
  notes text,
  recorded_by text not null,
  recorded_at timestamp with time zone not null default now()
);
alter table merchant_kyc_reviews enable row level security;
create index if not exists merchant_kyc_reviews_merchant_id_idx on merchant_kyc_reviews (merchant_id);

create policy "Staff can view merchant KYC reviews"
  on merchant_kyc_reviews for select to authenticated
  using (has_permission('merchant_kyc.view'));

create policy "Staff can insert merchant KYC reviews"
  on merchant_kyc_reviews for insert to authenticated
  with check (has_permission('merchant_kyc.manage'));
-- Append-only — a KYC coordination log is a historical record, not editable.

-- ── merchant_tills: till/payment-account creation tracking ─────────────
create table if not exists merchant_tills (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  status text not null default 'requested' check (status in ('requested', 'created', 'active', 'suspended')),
  partner_till_reference text,
  requested_at timestamp with time zone not null default now(),
  created_at_partner date,
  notes text,
  created_by text not null,
  updated_at timestamp with time zone not null default now()
);
alter table merchant_tills enable row level security;
create index if not exists merchant_tills_merchant_id_idx on merchant_tills (merchant_id);

drop trigger if exists merchant_tills_set_updated_at on merchant_tills;
create trigger merchant_tills_set_updated_at
  before update on merchant_tills
  for each row
  execute function set_updated_at();

create policy "Staff can view merchant tills"
  on merchant_tills for select to authenticated
  using (has_permission('merchant_tills.view'));

create policy "Staff can manage merchant tills"
  on merchant_tills for all to authenticated
  using (has_permission('merchant_tills.manage'))
  with check (has_permission('merchant_tills.manage'));

-- ── merchant_settlement_beneficiaries: verified settlement destinations ──
-- account_reference holds the full value but the app layer (a) always
-- masks it in the UI to the last 4 characters (src/lib/security/mask.ts),
-- and (b) never writes the raw value into audit_logs — same pattern as
-- contract_sensitive_details.bank_account_number. Restricted to its own
-- merchant_beneficiaries.view/manage permission, not the general
-- merchants.view/manage used by the rest of this module.
create table if not exists merchant_settlement_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  beneficiary_type text not null check (beneficiary_type in ('bank_account', 'mobile_wallet')),
  beneficiary_name text not null,
  account_reference text not null,
  bank_or_provider_name text,
  verification_status text not null default 'pending_verification' check (verification_status in ('pending_verification', 'verified', 'rejected')),
  is_primary boolean not null default false,
  created_by text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table merchant_settlement_beneficiaries enable row level security;
create index if not exists merchant_settlement_beneficiaries_merchant_id_idx on merchant_settlement_beneficiaries (merchant_id);

drop trigger if exists merchant_settlement_beneficiaries_set_updated_at on merchant_settlement_beneficiaries;
create trigger merchant_settlement_beneficiaries_set_updated_at
  before update on merchant_settlement_beneficiaries
  for each row
  execute function set_updated_at();

create policy "Staff can view merchant settlement beneficiaries"
  on merchant_settlement_beneficiaries for select to authenticated
  using (has_permission('merchant_beneficiaries.view'));

create policy "Staff can manage merchant settlement beneficiaries"
  on merchant_settlement_beneficiaries for all to authenticated
  using (has_permission('merchant_beneficiaries.manage'))
  with check (has_permission('merchant_beneficiaries.manage'));

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('merchants.view', 'merchant_operations', 'View merchant applications and profiles'),
  ('merchants.manage', 'merchant_operations', 'Create/edit merchants, change onboarding status, assign staff'),
  ('merchants.compliance_hold', 'merchant_operations', 'Place or release a compliance hold on a merchant'),
  ('merchant_kyc.view', 'merchant_operations', 'View KYC coordination records'),
  ('merchant_kyc.manage', 'merchant_operations', 'Record KYC submissions and partner responses'),
  ('merchant_tills.view', 'merchant_operations', 'View merchant till/payment-account records'),
  ('merchant_tills.manage', 'merchant_operations', 'Manage merchant till/payment-account records'),
  ('merchant_beneficiaries.view', 'merchant_operations', 'View merchant settlement beneficiaries (masked)'),
  ('merchant_beneficiaries.manage', 'merchant_operations', 'Manage merchant settlement beneficiaries')
on conflict (id) do nothing;

-- Standard safety-net backfill (see 20260731040000's comment for why this
-- is required every time new permissions are added).
insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('ceo', 'merchants.view'), ('ceo', 'merchant_kyc.view'), ('ceo', 'merchant_tills.view'), ('ceo', 'merchant_beneficiaries.view'),

  ('operations', 'merchants.view'), ('operations', 'merchants.manage'),
  ('operations', 'merchant_tills.view'), ('operations', 'merchant_tills.manage'),
  ('operations', 'merchant_kyc.view'), ('operations', 'merchant_beneficiaries.view'),

  ('compliance_security', 'merchants.view'), ('compliance_security', 'merchants.compliance_hold'),
  ('compliance_security', 'merchant_kyc.view'), ('compliance_security', 'merchant_kyc.manage'),
  ('compliance_security', 'merchant_tills.view'),
  ('compliance_security', 'merchant_beneficiaries.view'), ('compliance_security', 'merchant_beneficiaries.manage')
on conflict do nothing;
