-- Secure Settlement Beneficiaries module. Restructures the
-- merchant_settlement_beneficiaries table (created in 20260806000000 as a
-- simple masked-display table with a plaintext account_reference column)
-- into the full spec: encrypted destination values, maker-checker approval,
-- cooling period, and a step-up re-authentication requirement.
--
-- Encryption follows the EXACT pattern already proven in this codebase for
-- provisioning_credentials (20260726020000_create_client_provisioning.sql):
-- pgp_sym_encrypt() happens inside a single SECURITY DEFINER function that
-- also does the permission check, so plaintext and key only ever meet
-- inside that one call. masked_destination_value is computed in the app
-- layer BEFORE encryption and is the only thing any page ever reads back —
-- there is no decrypt function anywhere in this migration, by design,
-- exactly like provisioning_credentials has none.

create extension if not exists pgcrypto;

-- ── merchant_settlement_beneficiaries: restructure to the full spec ────
alter table merchant_settlement_beneficiaries rename column beneficiary_type to destination_type;
alter table merchant_settlement_beneficiaries rename column beneficiary_name to account_holder_name;
alter table merchant_settlement_beneficiaries rename column bank_or_provider_name to bank_or_network_name;

alter table merchant_settlement_beneficiaries drop column if exists account_reference;

alter table merchant_settlement_beneficiaries
  add column if not exists bank_or_network_code text,
  add column if not exists encrypted_destination_value bytea,
  add column if not exists masked_destination_value text not null default '',
  add column if not exists verification_method text,
  add column if not exists verified_at timestamp with time zone,
  add column if not exists verified_by text,
  add column if not exists activated_at timestamp with time zone,
  add column if not exists deactivated_at timestamp with time zone,
  add column if not exists change_reason text,
  add column if not exists cooling_period_ends_at timestamp with time zone;

alter table merchant_settlement_beneficiaries drop constraint if exists merchant_settlement_beneficiaries_verification_status_check;
update merchant_settlement_beneficiaries set verification_status = 'pending' where verification_status = 'pending_verification';
alter table merchant_settlement_beneficiaries alter column verification_status set default 'pending';
alter table merchant_settlement_beneficiaries add constraint merchant_settlement_beneficiaries_verification_status_check check (verification_status in (
  'pending', 'under_review', 'verified', 'rejected', 'suspended', 'expired'
));

-- Writes to the base table now only ever happen inside the two
-- SECURITY DEFINER functions below (mirroring provisioning_credentials'
-- "no direct insert policy" comment) — drop the old broad "for all" policy
-- that allowed direct app-layer insert/update.
drop policy if exists "Staff can manage merchant settlement beneficiaries" on merchant_settlement_beneficiaries;

-- ── merchant_beneficiary_change_requests: maker-checker queue ──────────
-- No column on this table ever holds a plaintext destination value either
-- — proposed_encrypted_value/proposed_masked_value are populated by the
-- same request_merchant_beneficiary_change() function, at the same moment
-- the value is encrypted, so plaintext never lands in a table row anywhere.
create table if not exists merchant_beneficiary_change_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  beneficiary_id uuid references merchant_settlement_beneficiaries(id),
  request_type text not null check (request_type in ('add', 'change', 'verify', 'suspend')),

  proposed_destination_type text,
  proposed_account_holder_name text,
  proposed_bank_or_network_name text,
  proposed_bank_or_network_code text,
  proposed_encrypted_value bytea,
  proposed_masked_value text,
  proposed_verification_method text,
  proposed_is_primary boolean,

  change_reason text not null,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected')),
  requested_by text not null,
  requested_at timestamp with time zone not null default now(),
  reviewed_by text,
  reviewed_at timestamp with time zone,
  review_notes text
);
alter table merchant_beneficiary_change_requests enable row level security;
create index if not exists merchant_beneficiary_change_requests_merchant_id_idx on merchant_beneficiary_change_requests (merchant_id);
create index if not exists merchant_beneficiary_change_requests_status_idx on merchant_beneficiary_change_requests (status);

create policy "Staff can view beneficiary change requests with permission"
  on merchant_beneficiary_change_requests for select to authenticated
  using (has_permission('merchant_beneficiaries.view'));
-- No direct insert/update policy — see request_merchant_beneficiary_change()
-- and approve/reject functions below.

-- ── staff_reauth_sessions: step-up re-authentication marker ────────────
-- Records that a signed-in staff member re-entered their password within
-- the current session, for features that require step-up auth beyond an
-- ordinary session cookie. Purely a freshness marker — the real
-- authentication event is the signInWithPassword() call the app makes
-- before inserting this row; this table just lets the app check "was that
-- done recently" from a subsequent request.
create table if not exists staff_reauth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  purpose text not null default 'beneficiary_access',
  issued_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null
);
alter table staff_reauth_sessions enable row level security;
create index if not exists staff_reauth_sessions_user_id_idx on staff_reauth_sessions (user_id, purpose, expires_at);

create policy "Staff can view their own reauth sessions"
  on staff_reauth_sessions for select to authenticated
  using (user_id = auth.uid());

create policy "Staff can record their own reauth sessions"
  on staff_reauth_sessions for insert to authenticated
  with check (user_id = auth.uid());

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('merchant_beneficiaries.approve', 'merchant_operations', 'Approve or reject settlement beneficiary change requests (checker role — must differ from the requester)')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  -- Onboarding Staff can now propose beneficiary changes (maker) but
  -- cannot approve them.
  ('operations', 'merchant_beneficiaries.view'), ('operations', 'merchant_beneficiaries.manage'),
  -- Compliance Officer can both propose and approve (never their own
  -- request — enforced in approve_merchant_beneficiary_change_request()).
  ('compliance_security', 'merchant_beneficiaries.approve')
on conflict do nothing;

-- ── request_merchant_beneficiary_change(): the only write path for a proposal ──
create or replace function request_merchant_beneficiary_change(
  p_merchant_id uuid,
  p_beneficiary_id uuid,
  p_request_type text,
  p_destination_type text,
  p_account_holder_name text,
  p_bank_or_network_name text,
  p_bank_or_network_code text,
  p_destination_value text,
  p_masked_value text,
  p_verification_method text,
  p_is_primary boolean,
  p_change_reason text,
  p_encryption_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_performer text;
begin
  if not has_permission('merchant_beneficiaries.manage') then
    raise exception 'Missing required permission: merchant_beneficiaries.manage';
  end if;

  if p_request_type not in ('add', 'change', 'verify', 'suspend') then
    raise exception 'Invalid request type: %', p_request_type;
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  insert into merchant_beneficiary_change_requests (
    merchant_id, beneficiary_id, request_type,
    proposed_destination_type, proposed_account_holder_name, proposed_bank_or_network_name,
    proposed_bank_or_network_code,
    proposed_encrypted_value, proposed_masked_value,
    proposed_verification_method, proposed_is_primary,
    change_reason, requested_by
  ) values (
    p_merchant_id, p_beneficiary_id, p_request_type,
    p_destination_type, p_account_holder_name, p_bank_or_network_name,
    p_bank_or_network_code,
    case when p_destination_value is not null then pgp_sym_encrypt(p_destination_value, p_encryption_key) else null end,
    p_masked_value,
    p_verification_method, p_is_primary,
    p_change_reason, v_performer
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ── approve_merchant_beneficiary_change_request(): the only write path that touches the live table ──
-- Returns the masked before/after values so the calling action can write
-- an audit_logs entry without ever handling the encrypted or raw value
-- itself. Enforces maker-checker (reviewer must differ from requester) and
-- always sets a fresh cooling_period_ends_at on every applied change.
create or replace function approve_merchant_beneficiary_change_request(
  p_request_id uuid,
  p_review_notes text,
  p_cooling_period_hours integer
)
returns table (
  beneficiary_id uuid,
  old_masked_value text,
  new_masked_value text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_performer text;
  v_beneficiary_id uuid;
  v_old_masked text;
  v_new_masked text;
begin
  if not has_permission('merchant_beneficiaries.approve') then
    raise exception 'Missing required permission: merchant_beneficiaries.approve';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_req from merchant_beneficiary_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'Change request not found';
  end if;
  if v_req.status <> 'pending_approval' then
    raise exception 'Change request has already been reviewed';
  end if;
  if v_req.requested_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from the requester';
  end if;

  if v_req.request_type = 'add' then
    insert into merchant_settlement_beneficiaries (
      merchant_id, destination_type, account_holder_name, bank_or_network_name, bank_or_network_code,
      encrypted_destination_value, masked_destination_value, verification_method, is_primary,
      verification_status, change_reason, cooling_period_ends_at, created_by
    ) values (
      v_req.merchant_id, v_req.proposed_destination_type, v_req.proposed_account_holder_name,
      v_req.proposed_bank_or_network_name, v_req.proposed_bank_or_network_code,
      v_req.proposed_encrypted_value, v_req.proposed_masked_value, v_req.proposed_verification_method,
      coalesce(v_req.proposed_is_primary, false),
      'pending', v_req.change_reason, now() + make_interval(hours => p_cooling_period_hours), v_req.requested_by
    )
    returning id, null, masked_destination_value into v_beneficiary_id, v_old_masked, v_new_masked;

  elsif v_req.request_type = 'change' then
    select masked_destination_value into v_old_masked from merchant_settlement_beneficiaries where id = v_req.beneficiary_id;

    update merchant_settlement_beneficiaries set
      destination_type = coalesce(v_req.proposed_destination_type, destination_type),
      account_holder_name = coalesce(v_req.proposed_account_holder_name, account_holder_name),
      bank_or_network_name = coalesce(v_req.proposed_bank_or_network_name, bank_or_network_name),
      bank_or_network_code = coalesce(v_req.proposed_bank_or_network_code, bank_or_network_code),
      encrypted_destination_value = coalesce(v_req.proposed_encrypted_value, encrypted_destination_value),
      masked_destination_value = coalesce(v_req.proposed_masked_value, masked_destination_value),
      change_reason = v_req.change_reason,
      -- A destination change invalidates any prior verification — it must
      -- be re-verified before it can be paid out to again.
      verification_status = 'pending',
      cooling_period_ends_at = now() + make_interval(hours => p_cooling_period_hours)
    where id = v_req.beneficiary_id
    returning id, masked_destination_value into v_beneficiary_id, v_new_masked;

  elsif v_req.request_type = 'verify' then
    select masked_destination_value into v_old_masked from merchant_settlement_beneficiaries where id = v_req.beneficiary_id;

    update merchant_settlement_beneficiaries set
      verification_status = 'verified',
      verification_method = coalesce(v_req.proposed_verification_method, verification_method),
      verified_at = now(),
      verified_by = v_performer,
      activated_at = coalesce(activated_at, now()),
      cooling_period_ends_at = now() + make_interval(hours => p_cooling_period_hours)
    where id = v_req.beneficiary_id
    returning id, masked_destination_value into v_beneficiary_id, v_new_masked;
    v_new_masked := v_old_masked;

  elsif v_req.request_type = 'suspend' then
    select masked_destination_value into v_old_masked from merchant_settlement_beneficiaries where id = v_req.beneficiary_id;

    update merchant_settlement_beneficiaries set
      verification_status = 'suspended',
      deactivated_at = now()
    where id = v_req.beneficiary_id
    returning id, masked_destination_value into v_beneficiary_id, v_new_masked;
    v_new_masked := v_old_masked;
  end if;

  if v_req.proposed_is_primary then
    update merchant_settlement_beneficiaries set is_primary = false where merchant_id = v_req.merchant_id and id <> v_beneficiary_id;
    update merchant_settlement_beneficiaries set is_primary = true where id = v_beneficiary_id;
  end if;

  update merchant_beneficiary_change_requests set
    status = 'approved', reviewed_by = v_performer, reviewed_at = now(), review_notes = p_review_notes
  where id = p_request_id;

  return query select v_beneficiary_id, v_old_masked, v_new_masked;
end;
$$;

create or replace function reject_merchant_beneficiary_change_request(
  p_request_id uuid,
  p_review_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_performer text;
begin
  if not has_permission('merchant_beneficiaries.approve') then
    raise exception 'Missing required permission: merchant_beneficiaries.approve';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_req from merchant_beneficiary_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'Change request not found';
  end if;
  if v_req.status <> 'pending_approval' then
    raise exception 'Change request has already been reviewed';
  end if;
  if v_req.requested_by = v_performer then
    raise exception 'Maker-checker violation: the approver must be different from the requester';
  end if;

  update merchant_beneficiary_change_requests set
    status = 'rejected', reviewed_by = v_performer, reviewed_at = now(), review_notes = p_review_notes
  where id = p_request_id;
end;
$$;

-- Belt-and-suspenders: Postgres grants EXECUTE on a new function to PUBLIC
-- (including anon) by default. Each function above already refuses to do
-- anything for a caller has_permission() rejects — an anon caller has no
-- auth.uid() and so is already blocked internally — but there is no reason
-- to leave the RPC endpoint invokable by anon at all.
revoke execute on function request_merchant_beneficiary_change(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text) from public;
grant execute on function request_merchant_beneficiary_change(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text) to authenticated;

revoke execute on function approve_merchant_beneficiary_change_request(uuid, text, integer) from public;
grant execute on function approve_merchant_beneficiary_change_request(uuid, text, integer) to authenticated;

revoke execute on function reject_merchant_beneficiary_change_request(uuid, text) from public;
grant execute on function reject_merchant_beneficiary_change_request(uuid, text) to authenticated;
