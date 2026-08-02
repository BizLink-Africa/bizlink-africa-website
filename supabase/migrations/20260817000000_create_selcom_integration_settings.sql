-- Selcom Disbursement API Configuration (Administration -> Integrations ->
-- Disbursement API). This table and its functions hold NO credential
-- material whatsoever — not even encrypted. Every actual secret
-- (SELCOM_API_KEY, SELCOM_RSA_PRIVATE_KEY, SELCOM_DISBURSEMENT_ACCOUNT,
-- SELCOM_CALLBACK_SECRET) lives exclusively in server environment
-- variables, read by src/lib/selcom/config.ts — this migration only adds:
--   1. selcom_integration_settings: a singleton row of NON-secret
--      operational state (is the integration switched on, has production
--      activation been requested) — same `id boolean primary key default
--      true check (id)` singleton pattern as company_settings.
--   2. A handful of SECURITY DEFINER functions that mutate that state,
--      each independently permission-checked, following the same
--      "no direct insert/update policy — only RPCs" convention as
--      settlement_batches / merchant_payouts.
--   3. Four new permissions (view/manage/test/balance) scoped to this one
--      integration, not a blanket "integrations" permission, so Finance can
--      be granted balance visibility without also getting sandbox-test or
--      credential-management capability.
--
-- All six required log categories (credential configuration change,
-- environment change, connection test, balance check, callback
-- configuration change, production activation) are written to the
-- existing audit_logs table from the application layer (module =
-- 'selcom_integration'), exactly like every other module in this app —
-- there is deliberately no bespoke event table here.

-- ── selcom_integration_settings ─────────────────────────────────────────
create table if not exists selcom_integration_settings (
  id boolean primary key default true check (id),

  -- Kill switch: when false, the app layer refuses to run sandbox test /
  -- balance-check / disbursement actions even though the underlying env
  -- vars may be fully configured. Defaults to false — enabling Selcom
  -- capability at all is a deliberate Super Admin action, not a side
  -- effect of setting environment variables.
  integration_enabled boolean not null default false,

  -- A REQUEST, never an activation switch — src/lib/selcom/config.ts
  -- structurally refuses to build a 'production' config regardless of this
  -- value. Flipping to production remains a separate, deliberate
  -- infrastructure + code change, not something this table can cause.
  production_activation_status text not null default 'not_requested'
    check (production_activation_status in ('not_requested', 'requested')),
  production_activation_requested_by text,
  production_activation_requested_at timestamp with time zone,
  production_activation_reason text,

  -- Last-observed configuration snapshot, used only to DETECT drift in
  -- externally-managed env vars (Vercel) so a change can be logged to
  -- audit_logs even though this app never performed the change itself.
  -- Fingerprints are the SAME masked strings already shown in the UI
  -- (e.g. "****ab12") — never a reversible hash of the real value, never
  -- the value itself.
  last_observed_environment text,
  last_observed_api_key_fingerprint text,
  last_observed_disbursement_account_fingerprint text,
  last_observed_callback_configured boolean,
  last_observed_at timestamp with time zone,

  updated_by text,
  updated_at timestamp with time zone not null default now()
);

insert into selcom_integration_settings (id) values (true)
  on conflict (id) do nothing;

alter table selcom_integration_settings enable row level security;

create policy "Staff can view Selcom integration settings with permission"
  on selcom_integration_settings for select to authenticated
  using (has_permission('integrations.selcom.view'));

-- No insert/update policy at all: every write goes through the SECURITY
-- DEFINER functions below.

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('integrations.selcom.view', 'integrations', 'View Selcom disbursement integration configuration and status'),
  ('integrations.selcom.manage', 'integrations', 'Enable/disable the Selcom integration and request production activation'),
  ('integrations.selcom.test', 'integrations', 'Run Selcom sandbox connection and callback configuration checks'),
  ('integrations.selcom.balance', 'integrations', 'Check the Selcom disbursement account balance')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id in ('integrations.selcom.view', 'integrations.selcom.manage', 'integrations.selcom.test', 'integrations.selcom.balance')
  and id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

-- Technical Admin (cto): can test sandbox connectivity and check balance,
-- cannot manage (enable/disable, production activation).
-- Finance (cfo): can view status and balance, cannot test or manage.
-- CEO: view only, same "exec sees everything" pattern as every other
-- module (settlement.view / payouts.view granted to ceo elsewhere).
-- customer_support, marketing, operations, compliance_security: no rows —
-- no access, per spec ("Support users have no access").
insert into role_permissions (role_id, permission_id) values
  ('cto', 'integrations.selcom.view'), ('cto', 'integrations.selcom.test'), ('cto', 'integrations.selcom.balance'),
  ('cfo', 'integrations.selcom.view'), ('cfo', 'integrations.selcom.balance'),
  ('ceo', 'integrations.selcom.view')
on conflict do nothing;

-- ── set_selcom_integration_enabled(): the only way the kill switch moves ──
create or replace function set_selcom_integration_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_performer text;
begin
  if not has_permission('integrations.selcom.manage') then
    raise exception 'Missing required permission: integrations.selcom.manage';
  end if;
  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  update selcom_integration_settings set
    integration_enabled = p_enabled,
    updated_by = v_performer,
    updated_at = now()
  where id = true;
end;
$$;

revoke execute on function set_selcom_integration_enabled(boolean) from public;
grant execute on function set_selcom_integration_enabled(boolean) to authenticated;
revoke execute on function set_selcom_integration_enabled(boolean) from anon;

-- ── request_selcom_production_activation(): records a REQUEST only.
-- Structurally requires the integration to already be enabled and at
-- least one successful sandbox connection test on record — you cannot
-- request go-live for an integration nobody has ever successfully tested.
create or replace function request_selcom_production_activation(p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_performer text;
begin
  if not has_permission('integrations.selcom.manage') then
    raise exception 'Missing required permission: integrations.selcom.manage';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to request production activation.';
  end if;

  select * into v_row from selcom_integration_settings where id = true for update;
  if not v_row.integration_enabled then
    raise exception 'Enable the integration before requesting production activation.';
  end if;
  if v_row.production_activation_status = 'requested' then
    raise exception 'A production activation request is already pending.';
  end if;
  if not exists (
    select 1 from audit_logs
    where module = 'selcom_integration' and action_type = 'connection_test' and result = 'success'
  ) then
    raise exception 'At least one successful sandbox connection test is required before requesting production activation.';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  update selcom_integration_settings set
    production_activation_status = 'requested',
    production_activation_requested_by = v_performer,
    production_activation_requested_at = now(),
    production_activation_reason = trim(p_reason)
  where id = true;
end;
$$;

revoke execute on function request_selcom_production_activation(text) from public;
grant execute on function request_selcom_production_activation(text) to authenticated;
revoke execute on function request_selcom_production_activation(text) from anon;

-- ── sync_selcom_configuration_snapshot(): called on every page view to
-- detect drift in externally-managed (Vercel) env vars. Read-gated (not
-- manage-gated) since it's triggered by viewing the page, not a privileged
-- mutation — it only ever records what the app layer already computed from
-- process.env, never anything it derives independently. Returns which
-- dimensions changed so the caller can write the matching audit_logs
-- entries; does not write audit_logs itself (same division of
-- responsibility as every other RPC in this app — SQL mutates state, the
-- TypeScript action layer logs it).
create or replace function sync_selcom_configuration_snapshot(
  p_environment text,
  p_api_key_fingerprint text,
  p_disbursement_account_fingerprint text,
  p_callback_configured boolean
)
returns table (
  is_first_observation boolean,
  environment_changed boolean,
  credential_changed boolean,
  callback_changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_first boolean;
  v_env_changed boolean;
  v_cred_changed boolean;
  v_cb_changed boolean;
begin
  if not has_permission('integrations.selcom.view') then
    raise exception 'Missing required permission: integrations.selcom.view';
  end if;

  select * into v_row from selcom_integration_settings where id = true for update;

  v_first := v_row.last_observed_at is null;
  v_env_changed := not v_first and v_row.last_observed_environment is distinct from p_environment;
  v_cred_changed := not v_first and (
    v_row.last_observed_api_key_fingerprint is distinct from p_api_key_fingerprint
    or v_row.last_observed_disbursement_account_fingerprint is distinct from p_disbursement_account_fingerprint
  );
  v_cb_changed := not v_first and v_row.last_observed_callback_configured is distinct from p_callback_configured;

  update selcom_integration_settings set
    last_observed_environment = p_environment,
    last_observed_api_key_fingerprint = p_api_key_fingerprint,
    last_observed_disbursement_account_fingerprint = p_disbursement_account_fingerprint,
    last_observed_callback_configured = p_callback_configured,
    last_observed_at = now()
  where id = true;

  return query select v_first, v_env_changed, v_cred_changed, v_cb_changed;
end;
$$;

revoke execute on function sync_selcom_configuration_snapshot(text, text, text, boolean) from public;
grant execute on function sync_selcom_configuration_snapshot(text, text, text, boolean) to authenticated;
revoke execute on function sync_selcom_configuration_snapshot(text, text, text, boolean) from anon;
