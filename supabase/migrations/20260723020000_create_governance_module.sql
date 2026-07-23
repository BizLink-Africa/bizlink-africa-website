-- Governance module: a Roles & Permissions matrix (the roles / permissions /
-- role_permissions tables and their RLS already exist from the RBAC
-- foundation migration — roles.view/roles.manage were seeded but never used
-- by any page) plus a company policy document register (net new).

-- ============================================================
-- 1. New permissions for the policy register. Unlike the dormant
--    permissions used by the Marketing and Compliance & Security modules,
--    these did not exist when the RBAC migration ran its one-time
--    "super_admin gets every existing permission" insert, so super_admin
--    needs an explicit grant here too.
-- ============================================================

insert into permissions (id, module, description) values
  ('policies.view', 'policies', 'View company policy documents'),
  ('policies.manage', 'policies', 'Create/update company policy documents')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'policies.view'), ('super_admin', 'policies.manage'),
  ('ceo', 'policies.view'), ('ceo', 'policies.manage'),
  ('compliance_security', 'policies.view')
on conflict do nothing;

-- ============================================================
-- 2. Policy documents
-- ============================================================

create table if not exists governance_policies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  version text not null default '1.0',
  status text not null default 'draft',
  effective_date date,
  review_date date,
  owner text,
  content text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table governance_policies
  add constraint governance_policies_category_check check (category in (
    'hr', 'finance', 'security', 'data_protection', 'operations', 'other'
  ));

alter table governance_policies
  add constraint governance_policies_status_check check (status in ('draft', 'active', 'archived'));

create trigger governance_policies_set_updated_at
  before update on governance_policies
  for each row
  execute function set_updated_at();

alter table governance_policies enable row level security;
create policy "policies.view can select policies" on governance_policies for select to authenticated using (has_permission('policies.view'));
create policy "policies.manage can insert policies" on governance_policies for insert to authenticated with check (has_permission('policies.manage'));
create policy "policies.manage can update policies" on governance_policies for update to authenticated using (has_permission('policies.manage')) with check (has_permission('policies.manage'));
