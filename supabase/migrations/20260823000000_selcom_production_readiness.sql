-- Controlled sandbox-to-production activation workflow for the Selcom
-- Business integration. Nothing here EVER flips SELCOM_ENV or makes
-- production live by itself — that remains a separate, deliberate
-- deployment change (SELCOM_ENV=production AND
-- SELCOM_PRODUCTION_ACTIVATION_ENABLED=true, both set only on the one
-- authorised Vercel Production environment — see
-- src/lib/selcom/config.ts's resolveSelcomEnvironment()). What this
-- migration adds is the GOVERNANCE record: a 20-item readiness checklist,
-- separate Finance and Compliance approvals, and a final "authorized"
-- marker that a human must set before anyone would even consider making
-- that separate deployment change. "Do not activate production
-- automatically" is satisfied structurally: there is no code path from
-- any function below to SELCOM_ENV or to any live Selcom call.
--
-- Design:
--   1. selcom_production_readiness_checks: one row per checklist item
--      (20 fixed, seeded keys), each independently marked passed/failed/
--      not_applicable/not_started by whoever holds
--      selcom_production.manage_checklist.
--   2. selcom_integration_settings gains Finance approval, Compliance
--      approval, and final authorization columns — "Finance and
--      compliance approval recorded" is modeled as two genuinely separate
--      approvals (distinct permissions, distinct approvers), not one
--      generic checkbox.
--   3. authorize_selcom_production_activation() is the only function that
--      sets production_activation_authorized = true, and only succeeds
--      when every checklist item is passed/not_applicable AND both
--      approvals are recorded. Super Admin only.
--   4. merchant_payouts gains an `environment` column, frozen the same
--      way amount/currency/merchant_id already are (see
--      block_immutable_merchant_payout_mutation()) — "never copy sandbox
--      payout records into production records" is enforced by every
--      payout permanently recording which environment created it, unable
--      to be changed after the fact.

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('selcom_production.view', 'integrations', 'View the Selcom production readiness checklist and approval status'),
  ('selcom_production.manage_checklist', 'integrations', 'Mark Selcom production readiness checklist items passed/failed/not applicable'),
  ('selcom_production.approve_finance', 'integrations', 'Record or revoke Finance approval for Selcom production activation'),
  ('selcom_production.approve_compliance', 'integrations', 'Record or revoke Compliance approval for Selcom production activation'),
  ('selcom_production.authorize', 'integrations', 'Authorize (or de-authorize) Selcom production activation once the checklist and both approvals are complete')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id like 'selcom_production.%'
    and id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('cto', 'selcom_production.view'),
  ('cto', 'selcom_production.manage_checklist'),
  ('cfo', 'selcom_production.view'),
  ('cfo', 'selcom_production.approve_finance'),
  ('compliance_security', 'selcom_production.view'),
  ('compliance_security', 'selcom_production.approve_compliance')
on conflict do nothing;

-- ── selcom_production_readiness_checks ──────────────────────────────────
create table if not exists selcom_production_readiness_checks (
  item_key text primary key,
  status text not null default 'not_started' check (status in ('not_started', 'passed', 'failed', 'not_applicable')),
  notes text,
  checked_by text,
  checked_at timestamp with time zone
);

alter table selcom_production_readiness_checks enable row level security;
create policy "Staff can view the production readiness checklist with permission"
  on selcom_production_readiness_checks for select to authenticated
  using (has_permission('selcom_production.view'));
-- No insert/update policy — every write goes through
-- set_selcom_production_readiness_check() below.

insert into selcom_production_readiness_checks (item_key) values
  ('sandbox_credentials_configured'),
  ('rsa_signing_tests_passed'),
  ('balance_api_passed'),
  ('account_lookup_passed'),
  ('bank_sandbox_payout_passed'),
  ('mobile_wallet_sandbox_payout_passed'),
  ('status_checking_passed'),
  ('callback_received_validated'),
  ('duplicate_transaction_test_passed'),
  ('idempotency_test_passed'),
  ('maker_checker_test_passed'),
  ('beneficiary_verification_passed'),
  ('reconciliation_passed'),
  ('financial_audit_logs_passed'),
  ('rls_security_review_passed'),
  ('environment_secrets_reviewed'),
  ('production_credentials_generated'),
  ('production_callback_registered'),
  ('production_ip_whitelist_confirmed'),
  ('infinity_disbursement_production_account_confirmed')
on conflict (item_key) do nothing;

-- ── selcom_integration_settings: approval + authorization columns ──────
alter table selcom_integration_settings
  add column if not exists production_finance_approved boolean not null default false,
  add column if not exists production_finance_approved_by text,
  add column if not exists production_finance_approved_at timestamp with time zone,
  add column if not exists production_finance_approval_reason text,
  add column if not exists production_compliance_approved boolean not null default false,
  add column if not exists production_compliance_approved_by text,
  add column if not exists production_compliance_approved_at timestamp with time zone,
  add column if not exists production_compliance_approval_reason text,
  -- The final gate. Still never makes anything live by itself — see the
  -- header comment. "Production activation must be disabled by default":
  -- defaults to false, and nothing in this migration flips it.
  add column if not exists production_activation_authorized boolean not null default false,
  add column if not exists production_activation_authorized_by text,
  add column if not exists production_activation_authorized_at timestamp with time zone,
  add column if not exists production_activation_authorization_reason text,
  add column if not exists production_deauthorized_by text,
  add column if not exists production_deauthorized_at timestamp with time zone,
  add column if not exists production_deauthorization_reason text;

-- ── set_selcom_production_readiness_check() ─────────────────────────────
create or replace function set_selcom_production_readiness_check(
  p_item_key text,
  p_status text,
  p_notes text,
  p_performed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('selcom_production.manage_checklist') then
    raise exception 'Missing required permission: selcom_production.manage_checklist';
  end if;
  if p_status not in ('not_started', 'passed', 'failed', 'not_applicable') then
    raise exception 'Invalid checklist status: %', p_status;
  end if;

  update selcom_production_readiness_checks set
    status = p_status,
    notes = p_notes,
    checked_by = p_performed_by,
    checked_at = now()
  where item_key = p_item_key;

  if not found then
    raise exception 'Unknown production readiness checklist item: %', p_item_key;
  end if;
end;
$$;

revoke execute on function set_selcom_production_readiness_check(text, text, text, text) from public;
grant execute on function set_selcom_production_readiness_check(text, text, text, text) to authenticated;
revoke execute on function set_selcom_production_readiness_check(text, text, text, text) from anon;

-- ── record_selcom_production_finance_approval() /
-- record_selcom_production_compliance_approval(): two genuinely separate
-- approvals, two genuinely separate permissions. p_approved = false
-- records a REVOCATION (with its own required reason), not a delete —
-- the "who approved, when, why" and "who revoked, when, why" trail always
-- lives in audit_logs via the calling action, same as every other mutation
-- in this integration. ───────────────────────────────────────────────────
create or replace function record_selcom_production_finance_approval(
  p_approved boolean,
  p_reason text,
  p_performed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('selcom_production.approve_finance') then
    raise exception 'Missing required permission: selcom_production.approve_finance';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to record or revoke Finance approval';
  end if;

  update selcom_integration_settings set
    production_finance_approved = p_approved,
    production_finance_approved_by = p_performed_by,
    production_finance_approved_at = now(),
    production_finance_approval_reason = p_reason
  where id = true;
end;
$$;

revoke execute on function record_selcom_production_finance_approval(boolean, text, text) from public;
grant execute on function record_selcom_production_finance_approval(boolean, text, text) to authenticated;
revoke execute on function record_selcom_production_finance_approval(boolean, text, text) from anon;

create or replace function record_selcom_production_compliance_approval(
  p_approved boolean,
  p_reason text,
  p_performed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('selcom_production.approve_compliance') then
    raise exception 'Missing required permission: selcom_production.approve_compliance';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to record or revoke Compliance approval';
  end if;

  update selcom_integration_settings set
    production_compliance_approved = p_approved,
    production_compliance_approved_by = p_performed_by,
    production_compliance_approved_at = now(),
    production_compliance_approval_reason = p_reason
  where id = true;
end;
$$;

revoke execute on function record_selcom_production_compliance_approval(boolean, text, text) from public;
grant execute on function record_selcom_production_compliance_approval(boolean, text, text) to authenticated;
revoke execute on function record_selcom_production_compliance_approval(boolean, text, text) from anon;

-- ── authorize_selcom_production_activation() / deauthorize... ──────────
-- The final DB-side gate. Requires every checklist item to be passed or
-- not_applicable, and both approvals to be currently recorded. Even once
-- authorized, this table alone changes nothing about which Selcom
-- credentials or base URL any request actually uses — see the migration
-- header comment.
create or replace function authorize_selcom_production_activation(
  p_reason text,
  p_performed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings record;
  v_incomplete_count integer;
begin
  if not has_permission('selcom_production.authorize') then
    raise exception 'Missing required permission: selcom_production.authorize';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to authorize production activation';
  end if;

  select count(*) into v_incomplete_count
  from selcom_production_readiness_checks
  where status not in ('passed', 'not_applicable');

  if v_incomplete_count > 0 then
    raise exception 'Cannot authorize: % production readiness checklist item(s) are not yet passed or marked not applicable.', v_incomplete_count;
  end if;

  select * into v_settings from selcom_integration_settings where id = true for update;
  if not v_settings.production_finance_approved then
    raise exception 'Cannot authorize: Finance approval has not been recorded.';
  end if;
  if not v_settings.production_compliance_approved then
    raise exception 'Cannot authorize: Compliance approval has not been recorded.';
  end if;

  update selcom_integration_settings set
    production_activation_authorized = true,
    production_activation_authorized_by = p_performed_by,
    production_activation_authorized_at = now(),
    production_activation_authorization_reason = p_reason
  where id = true;
end;
$$;

revoke execute on function authorize_selcom_production_activation(text, text) from public;
grant execute on function authorize_selcom_production_activation(text, text) to authenticated;
revoke execute on function authorize_selcom_production_activation(text, text) from anon;

create or replace function deauthorize_selcom_production_activation(
  p_reason text,
  p_performed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('selcom_production.authorize') then
    raise exception 'Missing required permission: selcom_production.authorize';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to de-authorize production activation';
  end if;

  update selcom_integration_settings set
    production_activation_authorized = false,
    production_deauthorized_by = p_performed_by,
    production_deauthorized_at = now(),
    production_deauthorization_reason = p_reason
  where id = true;
end;
$$;

revoke execute on function deauthorize_selcom_production_activation(text, text) from public;
grant execute on function deauthorize_selcom_production_activation(text, text) to authenticated;
revoke execute on function deauthorize_selcom_production_activation(text, text) from anon;

-- ── merchant_payouts.environment: "never copy sandbox payout records
-- into production records" ─────────────────────────────────────────────
alter table merchant_payouts
  add column if not exists environment text not null default 'sandbox' check (environment in ('sandbox', 'production'));

-- Freeze it the same way amount/currency/merchant_id already are, once a
-- payout leaves pending_approval — same signature, safe in-place replace.
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
    or new.environment is distinct from old.environment
  );

  if old.status <> 'pending_approval' and v_core_changed then
    raise exception 'Payout amount, linkage, and environment are locked once a payout leaves pending_approval.';
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

-- ── create_merchant_payouts_for_batch(): widened to stamp environment.
-- Signature change — the old 1-argument overload must be explicitly
-- dropped, per this codebase's standing CREATE-OR-REPLACE-doesn't-replace-
-- changed-signatures lesson. ─────────────────────────────────────────────
drop function if exists create_merchant_payouts_for_batch(uuid);

create or replace function create_merchant_payouts_for_batch(p_batch_id uuid, p_environment text)
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
  if p_environment not in ('sandbox', 'production') then
    raise exception 'Invalid environment: %', p_environment;
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
      destination_type, amount, currency, idempotency_key, requested_by, environment
    )
    select
      next_finance_number('PAY'), p_batch_id, v_line.id, v_line.merchant_id, v_line.beneficiary_id,
      msb.destination_type, v_line.net_amount, 'TZS', 'PAYOUT-' || v_line.id::text, v_performer, p_environment
    from (select 1) as dummy
    left join merchant_settlement_beneficiaries msb on msb.id = v_line.beneficiary_id;

    v_created_count := v_created_count + 1;

    insert into merchant_payout_events (payout_id, event_type, performed_by)
    select id, 'requested', v_performer from merchant_payouts where settlement_batch_line_id = v_line.id;
  end loop;

  return v_created_count;
end;
$$;

revoke execute on function create_merchant_payouts_for_batch(uuid, text) from public;
grant execute on function create_merchant_payouts_for_batch(uuid, text) to authenticated;
revoke execute on function create_merchant_payouts_for_batch(uuid, text) from anon;
