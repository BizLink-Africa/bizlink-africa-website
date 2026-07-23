-- Client Provisioning: technical activation profile per client (enabled
-- modules, integration metadata, training/handover status) plus a
-- credentials vault for API keys/webhook secrets.
--
-- Reuses the provisioning.view / provisioning.manage permissions already
-- seeded (but never granted to a real role) by the RBAC foundation
-- migration — this is that dormant module actually shipping.
--
-- Credentials are encrypted at rest with pgcrypto and NEVER decrypted by
-- the app again after creation. insert_provisioning_credential() is the
-- only way to write a secret: it does the permission check and the
-- pgp_sym_encrypt() in one security-definer call, so the plaintext secret
-- and the encryption key only ever meet inside this one function
-- invocation. No corresponding decrypt function exists, and no page or
-- query ever selects secret_value_encrypted — only masked_preview
-- (captured from the plaintext at write time, before encryption) is
-- readable through the app.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. client_provisioning
-- ============================================================

create table if not exists client_provisioning (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,

  enabled_modules text[] not null default '{}',
  integration_metadata jsonb not null default '{}'::jsonb,
  technical_owner uuid references staff_profiles(id) on delete set null,

  activation_date date,
  training_status text not null default 'not_started',
  handover_status text not null default 'not_started',

  notes text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table client_provisioning
  add constraint client_provisioning_training_status_check check (training_status in (
    'not_started', 'in_progress', 'completed'
  ));
alter table client_provisioning
  add constraint client_provisioning_handover_status_check check (handover_status in (
    'not_started', 'in_progress', 'completed'
  ));

create trigger client_provisioning_set_updated_at
  before update on client_provisioning
  for each row
  execute function set_updated_at();

alter table client_provisioning enable row level security;
create policy "provisioning.view can select client_provisioning" on client_provisioning for select to authenticated using (has_permission('provisioning.view'));
create policy "provisioning.manage can insert client_provisioning" on client_provisioning for insert to authenticated with check (has_permission('provisioning.manage'));
create policy "provisioning.manage can update client_provisioning" on client_provisioning for update to authenticated using (has_permission('provisioning.manage')) with check (has_permission('provisioning.manage'));

-- ============================================================
-- 2. provisioning_credentials
-- ============================================================

create table if not exists provisioning_credentials (
  id uuid primary key default gen_random_uuid(),
  provisioning_id uuid not null references client_provisioning(id) on delete cascade,
  credential_type text not null,
  label text not null,
  secret_value_encrypted bytea not null,
  masked_preview text not null,
  created_by text,
  created_at timestamp with time zone not null default now()
);

alter table provisioning_credentials
  add constraint provisioning_credentials_type_check check (credential_type in (
    'api_key', 'api_secret', 'webhook_secret', 'webhook_url', 'other'
  ));

alter table provisioning_credentials enable row level security;
-- No direct insert policy: writes only go through insert_provisioning_credential()
-- below (security definer), so a raw insert from the app/PostgREST is never
-- possible even with provisioning.manage.
create policy "provisioning.view can select provisioning_credentials" on provisioning_credentials for select to authenticated using (has_permission('provisioning.view'));

-- ============================================================
-- 3. insert_provisioning_credential(): the only write path for secrets
-- ============================================================

create or replace function insert_provisioning_credential(
  p_provisioning_id uuid,
  p_credential_type text,
  p_label text,
  p_secret text,
  p_masked_preview text,
  p_encryption_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not has_permission('provisioning.manage') then
    raise exception 'Missing required permission: provisioning.manage';
  end if;

  insert into provisioning_credentials (
    provisioning_id, credential_type, label, secret_value_encrypted, masked_preview, created_by
  ) values (
    p_provisioning_id, p_credential_type, p_label,
    pgp_sym_encrypt(p_secret, p_encryption_key), p_masked_preview,
    coalesce((select email from auth.users where id = auth.uid()), 'unknown')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- 4. Role grants
-- ============================================================

insert into role_permissions (role_id, permission_id) values
  ('operations', 'provisioning.view'), ('operations', 'provisioning.manage'),
  ('ceo', 'provisioning.view')
on conflict do nothing;
