-- Selcom account-lookup integration for the existing Merchant Beneficiaries
-- module (GET /v1/account/lookup). Adds:
--   1. selcom_institution_codes: the ONLY source of valid institution
--      codes anywhere in the app — seeded exclusively from official Selcom
--      documentation (developer.selcom.business, "Destination
--      Shortcodes"), with no insert/update policy and no admin UI to add
--      one. A code can never be invented through this app, only added by
--      a deliberate, reviewed migration. Re-verify this list against
--      BizLink's live Selcom merchant documentation before production use.
--   2. merchant_beneficiary_lookups: one row per lookup attempt. Never
--      holds a raw account/wallet number — only the same masked form
--      already used for merchant_settlement_beneficiaries
--      (maskCredential(), computed in the app layer before this table is
--      ever touched). No decrypt step is needed anywhere in this feature:
--      the account number looked up is always freshly typed by staff for
--      this one live Selcom call, never read back out of encrypted
--      storage.
--   3. A lookup NEVER marks a beneficiary verified by itself. The returned
--      account name must be explicitly reviewed
--      (confirm_beneficiary_lookup_name_match) and, only then, can support
--      a 'verify' change request through the EXISTING maker-checker
--      pipeline (request_merchant_beneficiary_change /
--      approve_merchant_beneficiary_change_request) — this migration adds
--      a nullable supporting_lookup_id link for traceability, changes
--      nothing about who can approve what.
--   4. Closes a real gap: a beneficiary could be approved into a batch
--      while verified, then suspended before its payout was approved or
--      submitted, with nothing re-checking verification_status at either
--      of those two later, more consequential moments.
--      approve_merchant_payout() and begin_merchant_payout_submission()
--      now both re-check verification_status = 'verified' at the moment
--      they run, not just relying on the state settlement batch
--      preparation observed earlier.

-- ── selcom_institution_codes ────────────────────────────────────────────
create table if not exists selcom_institution_codes (
  code text primary key,
  name text not null,
  category text not null check (category in ('bank', 'mobile_wallet', 'selcom_internal')),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table selcom_institution_codes enable row level security;

create policy "Staff can view Selcom institution codes with permission"
  on selcom_institution_codes for select to authenticated
  using (has_permission('merchant_beneficiaries.view'));

insert into selcom_institution_codes (code, name, category) values
  ('SELCOM', 'Selcom Bank/Selcom Pesa/Selcom Business', 'selcom_internal'),
  ('ABSA', 'Absa Bank', 'bank'),
  ('BANCABC', 'Access Bank', 'bank'),
  ('ACB', 'Akiba Bank', 'bank'),
  ('AMANA', 'Amana Bank', 'bank'),
  ('AZANIA', 'Azania Bank', 'bank'),
  ('BOA', 'Bank of Africa', 'bank'),
  ('BOBTZ', 'Bank of Baroda', 'bank'),
  ('BOI', 'Bank of India', 'bank'),
  ('BOT', 'Bank of Tanzania', 'bank'),
  ('CANARA', 'Canara Bank', 'bank'),
  ('CITI', 'Citi Bank', 'bank'),
  ('CRDB', 'CRDB Bank', 'bank'),
  ('DCB', 'DCB Commercial Bank', 'bank'),
  ('DTB', 'Diamond Trust Bank', 'bank'),
  ('ECOBANK', 'Ecobank', 'bank'),
  ('EQUITY', 'Equity Bank', 'bank'),
  ('EXIM', 'Exim Bank', 'bank'),
  ('FINCA', 'Finca Microfinance Bank', 'bank'),
  ('GTBANK', 'Guaranty Trust Bank', 'bank'),
  ('HABIB', 'Habib African Bank', 'bank'),
  ('IMBANK', 'I&M Bank', 'bank'),
  ('ICB', 'International Commercial Bank', 'bank'),
  ('KCB', 'KCB Bank', 'bank'),
  ('LETSHEGO', 'Letshego Bank', 'bank'),
  ('MAENDELEO', 'Maendeleo Bank', 'bank'),
  ('MKOMBOZI', 'Mkombozi Commercial Bank', 'bank'),
  ('MUCOBA', 'MUCOBA Bank', 'bank'),
  ('MWALIMU', 'Mwalimu Commercial Bank', 'bank'),
  ('MWANGA', 'Mwanga Hakika Bank', 'bank'),
  ('NBC', 'National Bank of Commerce', 'bank'),
  ('NCBA', 'NCBA Bank', 'bank'),
  ('NMB', 'NMB Bank', 'bank'),
  ('PBZ', 'People''s Bank of Zanzibar', 'bank'),
  ('STANBIC', 'Stanbic Bank', 'bank'),
  ('SCB', 'Standard Chartered Bank', 'bank'),
  ('TCB', 'Tanzania Commercial Bank', 'bank'),
  ('UCHUMI', 'Uchumi Commercial Bank', 'bank'),
  ('UBA', 'United Bank for Africa', 'bank'),
  ('AIRTELMONEY', 'Airtel Money', 'mobile_wallet'),
  ('HALOPESA', 'Halo Pesa', 'mobile_wallet'),
  ('MIXXBYYAS', 'Mixx by Yas', 'mobile_wallet'),
  ('TTCLPESA', 'TTCL Pesa', 'mobile_wallet'),
  ('MPESA', 'Vodacom M-Pesa', 'mobile_wallet')
on conflict (code) do nothing;

-- ── merchant_beneficiary_lookups ────────────────────────────────────────
create table if not exists merchant_beneficiary_lookups (
  id uuid primary key default gen_random_uuid(),
  -- Also sent to Selcom as the lookup's transId — one identifier serves
  -- both purposes, same convention as merchant_payouts.payout_reference.
  lookup_reference text not null unique,
  merchant_id uuid not null references merchants(id),
  -- Nullable: a lookup can happen BEFORE a beneficiary row exists, to
  -- support deciding whether to propose adding one at all.
  beneficiary_id uuid references merchant_settlement_beneficiaries(id),
  institution_code text not null references selcom_institution_codes(code),
  -- Never the raw account/wallet number — see the migration header.
  masked_account text not null,
  returned_account_name text,
  charges jsonb,
  total_charges numeric(14, 2),
  status text not null check (status in ('success', 'failed')),
  failure_reason text,
  performed_by text not null,
  performed_at timestamp with time zone not null default now(),

  -- Requirement: the returned name must be explicitly reviewed against the
  -- merchant/authorised beneficiary before this lookup can support
  -- anything else. Defaults to unreviewed/unconfirmed.
  name_match_confirmed boolean not null default false,
  name_match_reviewed_by text,
  name_match_reviewed_at timestamp with time zone,
  name_match_notes text
);

alter table merchant_beneficiary_lookups enable row level security;
create index if not exists merchant_beneficiary_lookups_merchant_id_idx on merchant_beneficiary_lookups (merchant_id);
create index if not exists merchant_beneficiary_lookups_beneficiary_id_idx on merchant_beneficiary_lookups (beneficiary_id);

create policy "Staff can view Selcom beneficiary lookups with permission"
  on merchant_beneficiary_lookups for select to authenticated
  using (has_permission('merchant_beneficiaries.view'));

-- No insert/update policy — every write goes through the two SECURITY
-- DEFINER functions below.

-- ── Link a 'verify' change request to the lookup evidence that supports
-- it, purely for traceability. Does not change maker-checker mechanics —
-- approve_merchant_beneficiary_change_request() still requires a
-- different, separately-permissioned reviewer, exactly as before. ───────
alter table merchant_beneficiary_change_requests
  add column if not exists supporting_lookup_id uuid references merchant_beneficiary_lookups(id);

-- ── generate_selcom_lookup_reference(): the only way an app-layer caller
-- obtains a lookup transId. Wraps next_finance_number('LKP') with an
-- explicit permission check + locked-down grants, rather than exposing
-- next_finance_number() itself (which has no permission check of its own
-- and, being a pre-existing function with no explicit grants, is left
-- exactly as it was — this wrapper is the one new deliberate app-layer
-- entry point). Called BEFORE the Selcom request, since the reference must
-- be sent as transId in the outgoing call.
create or replace function generate_selcom_lookup_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('merchant_beneficiaries.manage') then
    raise exception 'Missing required permission: merchant_beneficiaries.manage';
  end if;
  return next_finance_number('LKP');
end;
$$;

revoke execute on function generate_selcom_lookup_reference() from public;
grant execute on function generate_selcom_lookup_reference() to authenticated;
revoke execute on function generate_selcom_lookup_reference() from anon;

-- ── record_merchant_beneficiary_lookup(): the only way a lookup row is
-- ever written. Takes only already-masked/non-secret values computed by
-- the app layer from the Selcom response — never sees a raw account
-- number itself. ─────────────────────────────────────────────────────────
create or replace function record_merchant_beneficiary_lookup(
  p_lookup_reference text,
  p_merchant_id uuid,
  p_beneficiary_id uuid,
  p_institution_code text,
  p_masked_account text,
  p_returned_account_name text,
  p_charges jsonb,
  p_total_charges numeric,
  p_status text,
  p_failure_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_performer text;
begin
  if not has_permission('merchant_beneficiaries.manage') then
    raise exception 'Missing required permission: merchant_beneficiaries.manage';
  end if;
  if p_status not in ('success', 'failed') then
    raise exception 'Invalid lookup status: %', p_status;
  end if;
  if not exists (select 1 from selcom_institution_codes where code = p_institution_code and is_active) then
    raise exception 'Unknown or inactive institution code: %', p_institution_code;
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  insert into merchant_beneficiary_lookups (
    lookup_reference, merchant_id, beneficiary_id, institution_code, masked_account,
    returned_account_name, charges, total_charges, status, failure_reason, performed_by
  ) values (
    p_lookup_reference, p_merchant_id, p_beneficiary_id, p_institution_code, p_masked_account,
    p_returned_account_name, p_charges, p_total_charges, p_status, p_failure_reason, v_performer
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function record_merchant_beneficiary_lookup(text, uuid, uuid, text, text, text, jsonb, numeric, text, text) from public;
grant execute on function record_merchant_beneficiary_lookup(text, uuid, uuid, text, text, text, jsonb, numeric, text, text) to authenticated;
revoke execute on function record_merchant_beneficiary_lookup(text, uuid, uuid, text, text, text, jsonb, numeric, text, text) from anon;

-- ── confirm_beneficiary_lookup_name_match(): the required human review
-- step — a lookup's returned name is never trusted on its own. ─────────
create or replace function confirm_beneficiary_lookup_name_match(
  p_lookup_id uuid,
  p_confirmed boolean,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_performer text;
begin
  if not has_permission('merchant_beneficiaries.manage') then
    raise exception 'Missing required permission: merchant_beneficiaries.manage';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  update merchant_beneficiary_lookups set
    name_match_confirmed = p_confirmed,
    name_match_reviewed_by = v_performer,
    name_match_reviewed_at = now(),
    name_match_notes = p_notes
  where id = p_lookup_id;

  if not found then
    raise exception 'Lookup record not found';
  end if;
end;
$$;

revoke execute on function confirm_beneficiary_lookup_name_match(uuid, boolean, text) from public;
grant execute on function confirm_beneficiary_lookup_name_match(uuid, boolean, text) to authenticated;
revoke execute on function confirm_beneficiary_lookup_name_match(uuid, boolean, text) from anon;

-- ── request_merchant_beneficiary_change(): unchanged except for one new
-- trailing, optional parameter (p_lookup_id) so a 'verify' proposal can
-- reference the lookup evidence that supports it. Safe to add via
-- create-or-replace: appended at the end with a default, so every
-- existing caller (which calls by named parameter via PostgREST) is
-- unaffected. ─────────────────────────────────────────────────────────
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
  p_encryption_key text,
  p_lookup_id uuid default null
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
    change_reason, requested_by, supporting_lookup_id
  ) values (
    p_merchant_id, p_beneficiary_id, p_request_type,
    p_destination_type, p_account_holder_name, p_bank_or_network_name,
    p_bank_or_network_code,
    case when p_destination_value is not null then pgp_sym_encrypt(p_destination_value, p_encryption_key) else null end,
    p_masked_value,
    p_verification_method, p_is_primary,
    p_change_reason, v_performer, p_lookup_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function request_merchant_beneficiary_change(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text, uuid) from public;
grant execute on function request_merchant_beneficiary_change(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text, uuid) to authenticated;
revoke execute on function request_merchant_beneficiary_change(uuid, uuid, text, text, text, text, text, text, text, text, boolean, text, text, uuid) from anon;

-- ── approve_merchant_payout(): unchanged except one new check — the
-- beneficiary must be verified RIGHT NOW, not just at some earlier point
-- (e.g. when its settlement batch line was created). Closes the gap where
-- a beneficiary could be suspended after batch approval but before its
-- payout is approved. ────────────────────────────────────────────────────
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
  if not exists (
    select 1 from merchant_settlement_beneficiaries
    where id = v_payout.beneficiary_id and verification_status = 'verified'
  ) then
    raise exception 'This payout''s beneficiary is not currently verified and cannot be approved';
  end if;

  update merchant_payouts set status = 'approved', approved_by = v_performer, approved_at = now()
  where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by)
  values (p_payout_id, 'approved', v_performer);
end;
$$;

-- ── begin_merchant_payout_submission(): same re-check, as a second,
-- independent layer — verification could still be revoked in the window
-- between approval and submission. ──────────────────────────────────────
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
  if v_payout.beneficiary_id is null or not exists (
    select 1 from merchant_settlement_beneficiaries
    where id = v_payout.beneficiary_id and verification_status = 'verified'
  ) then
    raise exception 'This payout''s beneficiary is not currently verified and cannot be submitted';
  end if;

  update merchant_payouts set status = 'submitted', submitted_at = now() where id = p_payout_id;

  insert into merchant_payout_events (payout_id, event_type, performed_by)
  values (p_payout_id, 'submitted', v_performer);
end;
$$;

-- Grants unchanged from the original migration (create-or-replace keeps
-- the function OID, but re-stating these is cheap, harmless, and keeps
-- this migration self-contained/independently readable).
revoke execute on function approve_merchant_payout(uuid) from public;
grant execute on function approve_merchant_payout(uuid) to authenticated;
revoke execute on function approve_merchant_payout(uuid) from anon;

revoke execute on function begin_merchant_payout_submission(uuid) from public;
grant execute on function begin_merchant_payout_submission(uuid) to authenticated;
revoke execute on function begin_merchant_payout_submission(uuid) from anon;
