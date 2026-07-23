-- Permission foundation for the full role-based platform. Replaces the
-- fixed 6-value staff_profiles.role CHECK constraint with a real roles
-- table (so custom roles can be added later without a schema migration),
-- adds a permission catalog, and maps permissions to roles.
--
-- Scope: this migration seeds the FULL permission catalog described in the
-- platform spec, including keys for modules that do not exist yet
-- (contracts, invoices, proformas, campaigns, etc.) so future phases don't
-- need to touch this table again. Only permissions for MODULES THAT
-- CURRENTLY EXIST are actually assigned to non-super_admin roles below —
-- super_admin gets everything; every other role gets nothing for
-- not-yet-built modules until those modules ship and someone deliberately
-- grants them.

-- ============================================================
-- 1. Tables
-- ============================================================

create table if not exists roles (
  id text primary key,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists permissions (
  id text primary key,
  module text not null,
  description text,
  created_at timestamp with time zone not null default now()
);

create table if not exists role_permissions (
  role_id text not null references roles(id) on delete cascade,
  permission_id text not null references permissions(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (role_id, permission_id)
);

create trigger roles_set_updated_at
  before update on roles
  for each row
  execute function set_updated_at();

-- ============================================================
-- 2. Seed the 8 default roles
-- ============================================================

insert into roles (id, name, description, is_system) values
  ('super_admin', 'Super Admin', 'Complete platform access. Only role that can manage roles, permissions, and security settings.', true),
  ('ceo', 'CEO', 'Full business visibility and executive approval authority.', true),
  ('cfo', 'CFO', 'Manages finance: invoices, proformas, expenses, financial reporting.', true),
  ('cto', 'CTO', 'Manages technical systems, integrations, AI agents, incidents.', true),
  ('operations', 'Operations', 'Manages leads, client onboarding, contracts, delivery.', true),
  ('customer_support', 'Customer Support', 'Manages support tickets and client service.', true),
  ('marketing', 'Marketing', 'Manages campaigns and lead generation.', true),
  ('compliance_security', 'Compliance & Security', 'Reviews access, compliance, and security activity.', true)
on conflict (id) do nothing;

-- ============================================================
-- 3. Seed the permission catalog
-- ============================================================

insert into permissions (id, module, description) values
  -- Dashboards (mostly dormant until each dashboard is built)
  ('dashboard.ceo.view', 'dashboard', 'View CEO Dashboard'),
  ('dashboard.finance.view', 'dashboard', 'View Finance Dashboard'),
  ('dashboard.technical.view', 'dashboard', 'View Technical Dashboard'),
  ('dashboard.operations.view', 'dashboard', 'View Operations Dashboard'),
  ('dashboard.support.view', 'dashboard', 'View Customer Support Dashboard'),
  ('dashboard.marketing.view', 'dashboard', 'View Marketing Dashboard'),
  ('dashboard.compliance.view', 'dashboard', 'View Compliance & Security Dashboard'),

  -- Clients (active module)
  ('clients.view', 'clients', 'View clients'),
  ('clients.create', 'clients', 'Create clients'),
  ('clients.update', 'clients', 'Update clients'),
  ('clients.delete', 'clients', 'Delete clients'),

  -- Leads (active module)
  ('leads.view', 'leads', 'View leads / inquiries'),
  ('leads.create', 'leads', 'Create leads'),
  ('leads.update', 'leads', 'Update leads'),
  ('leads.assign', 'leads', 'Assign leads to staff'),

  -- Services (active module)
  ('services.view', 'services', 'View client services'),
  ('services.manage', 'services', 'Activate/update client services'),

  -- Onboarding (active module)
  ('onboarding.view', 'onboarding', 'View onboarding checklists'),
  ('onboarding.manage', 'onboarding', 'Update onboarding checklists'),

  -- Contracts (dormant — module not built yet)
  ('contracts.view', 'contracts', 'View contracts'),
  ('contracts.create', 'contracts', 'Create contracts'),
  ('contracts.update', 'contracts', 'Update contracts'),
  ('contracts.approve', 'contracts', 'Approve contracts'),
  ('contracts.renew', 'contracts', 'Renew contracts'),
  ('contracts.terminate', 'contracts', 'Terminate contracts'),

  -- Proformas (dormant)
  ('proformas.view', 'proformas', 'View proforma invoices'),
  ('proformas.create', 'proformas', 'Create proforma invoices'),
  ('proformas.update', 'proformas', 'Update proforma invoices'),
  ('proformas.approve', 'proformas', 'Approve proforma invoices'),
  ('proformas.convert', 'proformas', 'Convert proforma to invoice'),

  -- Invoices (dormant)
  ('invoices.view', 'invoices', 'View invoices'),
  ('invoices.create', 'invoices', 'Create invoices'),
  ('invoices.update', 'invoices', 'Update invoices'),
  ('invoices.issue', 'invoices', 'Issue invoices'),
  ('invoices.record_payment', 'invoices', 'Record invoice payments'),
  ('invoices.cancel', 'invoices', 'Cancel invoices'),

  -- Expenses (dormant)
  ('expenses.view', 'expenses', 'View expenses'),
  ('expenses.create', 'expenses', 'Create expenses'),
  ('expenses.approve', 'expenses', 'Approve expenses'),
  ('expenses.reject', 'expenses', 'Reject expenses'),

  -- Finance reporting (dormant)
  ('finance.reports.view', 'finance', 'View financial reports'),
  ('finance.reports.export', 'finance', 'Export financial reports'),

  -- Provisioning (dormant)
  ('provisioning.view', 'provisioning', 'View client provisioning status'),
  ('provisioning.manage', 'provisioning', 'Manage client provisioning'),

  -- Campaigns (dormant)
  ('campaigns.view', 'campaigns', 'View marketing campaigns'),
  ('campaigns.manage', 'campaigns', 'Create/edit marketing campaigns'),

  -- Support tickets (active module)
  ('tickets.view', 'tickets', 'View support tickets'),
  ('tickets.create', 'tickets', 'Create support tickets'),
  ('tickets.assign', 'tickets', 'Assign support tickets'),
  ('tickets.update', 'tickets', 'Update support tickets'),
  ('tickets.resolve', 'tickets', 'Resolve support tickets'),
  ('tickets.escalate', 'tickets', 'Escalate support tickets'),

  -- Knowledge base (dormant)
  ('knowledge_base.view', 'knowledge_base', 'View knowledge base'),
  ('knowledge_base.manage', 'knowledge_base', 'Manage knowledge base articles'),

  -- Integrations / AI agents (active modules)
  ('integrations.view', 'integrations', 'View integration health'),
  ('integrations.manage', 'integrations', 'Manage integrations'),
  ('ai_agents.view', 'ai_agents', 'View AI agent configs'),
  ('ai_agents.manage', 'ai_agents', 'Manage AI agent configs'),

  -- Technical / incidents (dormant)
  ('system.health.view', 'system', 'View platform health metrics'),
  ('system.logs.view', 'system', 'View technical logs'),
  ('incidents.view', 'incidents', 'View system incidents'),
  ('incidents.manage', 'incidents', 'Manage system incidents'),

  -- Compliance / security (dormant)
  ('compliance.view', 'compliance', 'View compliance records'),
  ('compliance.manage', 'compliance', 'Manage compliance reviews'),
  ('security.view', 'security', 'View security activity'),
  ('security.manage', 'security', 'Manage security settings'),

  -- Audit (active module)
  ('audit.view', 'audit', 'View audit logs'),

  -- Reports (dormant — centralized reports module)
  ('reports.view', 'reports', 'View reports'),
  ('reports.export', 'reports', 'Export reports'),

  -- Staff / roles (active module)
  ('users.view', 'users', 'View staff'),
  ('users.manage', 'users', 'Invite/deactivate/reactivate staff'),
  ('roles.view', 'roles', 'View roles and permissions'),
  ('roles.manage', 'roles', 'Create roles and change role assignments/permissions'),

  -- Settings (active module)
  ('settings.view', 'settings', 'View settings'),
  ('settings.manage', 'settings', 'Change settings')
on conflict (id) do nothing;

-- ============================================================
-- 4. Role -> permission assignments
--    super_admin gets everything. Every other role gets only the
--    permissions relevant to modules that exist today; dormant-module
--    permissions for other roles will be assigned when those modules ship.
-- ============================================================

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  -- CEO: broad read visibility across every existing module + staff view
  ('ceo', 'clients.view'), ('ceo', 'leads.view'), ('ceo', 'services.view'),
  ('ceo', 'onboarding.view'), ('ceo', 'tickets.view'), ('ceo', 'integrations.view'),
  ('ceo', 'ai_agents.view'), ('ceo', 'audit.view'), ('ceo', 'users.view'),
  ('ceo', 'roles.view'), ('ceo', 'settings.view'),

  -- CFO: minimal today (no finance module built yet) — client visibility only
  ('cfo', 'clients.view'),

  -- CTO: integrations + AI agents, view/manage; audit visibility
  ('cto', 'integrations.view'), ('cto', 'integrations.manage'),
  ('cto', 'ai_agents.view'), ('cto', 'ai_agents.manage'),
  ('cto', 'audit.view'), ('cto', 'clients.view'),

  -- Operations: leads, clients, services, onboarding — full working set
  ('operations', 'leads.view'), ('operations', 'leads.create'), ('operations', 'leads.update'), ('operations', 'leads.assign'),
  ('operations', 'clients.view'), ('operations', 'clients.create'), ('operations', 'clients.update'),
  ('operations', 'services.view'), ('operations', 'services.manage'),
  ('operations', 'onboarding.view'), ('operations', 'onboarding.manage'),

  -- Customer Support: tickets + client visibility
  ('customer_support', 'tickets.view'), ('customer_support', 'tickets.create'),
  ('customer_support', 'tickets.assign'), ('customer_support', 'tickets.update'),
  ('customer_support', 'tickets.resolve'), ('customer_support', 'tickets.escalate'),
  ('customer_support', 'clients.view'),

  -- Marketing: leads + client visibility (no campaigns module yet)
  ('marketing', 'leads.view'), ('marketing', 'clients.view'),

  -- Compliance & Security: audit, onboarding, client visibility
  ('compliance_security', 'audit.view'), ('compliance_security', 'clients.view'),
  ('compliance_security', 'onboarding.view')
on conflict do nothing;

-- ============================================================
-- 5. Migrate staff_profiles.role from a fixed enum to a roles FK
-- ============================================================

-- Drop the old fixed-enum constraint FIRST — otherwise the data migration
-- below fails, since 'customer_support'/'compliance_security' aren't in the
-- original 6-value CHECK list.
alter table staff_profiles drop constraint if exists staff_profiles_role_check;

-- Real data migration: map the 2 existing non-super_admin roles to their
-- closest equivalent in the new 8-role model. 'admin', 'sales_staff', and
-- 'technical_staff' were valid under the old CHECK constraint but have no
-- existing rows, so no data mapping is needed for them.
update staff_profiles set role = 'customer_support' where role = 'support_staff';
update staff_profiles set role = 'compliance_security' where role = 'compliance_officer';

alter table staff_profiles
  add constraint staff_profiles_role_fkey foreign key (role) references roles(id);

-- ============================================================
-- 6. Permission-check helper + RLS for the new tables
-- ============================================================

create or replace function has_permission(perm_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from staff_profiles sp
    join role_permissions rp on rp.role_id = sp.role
    where sp.user_id = auth.uid()
      and sp.is_active = true
      and rp.permission_id = perm_key
  );
$$;

alter table roles enable row level security;
create policy "Active staff can view roles" on roles for select to authenticated using (is_active_staff());
create policy "roles.manage can insert roles" on roles for insert to authenticated with check (has_permission('roles.manage'));
create policy "roles.manage can update roles" on roles for update to authenticated using (has_permission('roles.manage')) with check (has_permission('roles.manage'));
create policy "roles.manage can delete non-system roles" on roles for delete to authenticated using (has_permission('roles.manage') and not is_system);

alter table permissions enable row level security;
create policy "Active staff can view permissions" on permissions for select to authenticated using (is_active_staff());
-- No insert/update/delete policy: the permission catalog is migration-managed only.

alter table role_permissions enable row level security;
create policy "Active staff can view role_permissions" on role_permissions for select to authenticated using (is_active_staff());
create policy "roles.manage can insert role_permissions" on role_permissions for insert to authenticated with check (has_permission('roles.manage'));
create policy "roles.manage can delete role_permissions" on role_permissions for delete to authenticated using (has_permission('roles.manage'));

-- ============================================================
-- 7. Server-side enforcement for role/status changes on staff_profiles
--    (defense in depth beyond app-layer checks — this cannot be bypassed
--    by a bug in application code, since it runs inside the database).
-- ============================================================

create or replace function protect_staff_role_changes()
returns trigger as $$
begin
  -- Service-role/scripted operations have no authenticated user context and
  -- are already fully trusted (they bypass RLS entirely) — skip these
  -- checks so emergency recovery via the service role key still works.
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not has_permission('roles.manage') then
    raise exception 'Only users with roles.manage permission can change staff roles';
  end if;

  if new.is_active is distinct from old.is_active and not has_permission('users.manage') then
    raise exception 'Only users with users.manage permission can change account status';
  end if;

  -- Never allow the last active super_admin to be demoted or deactivated,
  -- regardless of who is performing the change.
  if old.role = 'super_admin' and old.is_active = true
     and (new.role is distinct from 'super_admin' or new.is_active = false) then
    if (
      select count(*) from staff_profiles
      where role = 'super_admin' and is_active = true and id != old.id
    ) = 0 then
      raise exception 'Cannot remove the last active Super Admin';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists staff_profiles_protect_role_changes on staff_profiles;
create trigger staff_profiles_protect_role_changes
  before update on staff_profiles
  for each row
  execute function protect_staff_role_changes();
