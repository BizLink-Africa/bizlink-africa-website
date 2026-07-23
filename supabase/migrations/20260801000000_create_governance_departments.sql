-- Governance: Departments. Net new — unlike Policies/Access Reviews, no
-- other module had a department register before this (support_tickets,
-- compliance_reviews, access_reviews only ever stored "department" as a
-- loose free-text label). staff_count is deliberately NOT a stored column —
-- computed live by counting staff_profiles.department, same pattern as
-- Staff & Roles' live lead/ticket counts, so it can never drift.

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  manager text,
  description text,
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table departments
  add constraint departments_status_check check (status in ('active', 'inactive'));

create trigger departments_set_updated_at
  before update on departments
  for each row
  execute function set_updated_at();

alter table departments enable row level security;
create policy "departments.view can select departments" on departments for select to authenticated using (has_permission('departments.view'));
create policy "departments.manage can insert departments" on departments for insert to authenticated with check (has_permission('departments.manage'));
create policy "departments.manage can update departments" on departments for update to authenticated using (has_permission('departments.manage')) with check (has_permission('departments.manage'));

insert into departments (name, status) values
  ('Executive', 'active'),
  ('Finance', 'active'),
  ('Technology', 'active'),
  ('Operations', 'active'),
  ('Marketing', 'active'),
  ('Customer Support', 'active'),
  ('Compliance & Security', 'active'),
  ('Administration', 'active')
on conflict (name) do nothing;

-- Which department a staff member belongs to. Free-text-checked against the
-- same 8-name catalog rather than an FK to departments.id, so it survives
-- even if a department row is later renamed/removed — matches the
-- support_tickets.department pattern, not a hard relational link.
alter table staff_profiles add column if not exists department text;
alter table staff_profiles
  add constraint staff_profiles_department_check check (department is null or department in (
    'Executive', 'Finance', 'Technology', 'Operations', 'Marketing',
    'Customer Support', 'Compliance & Security', 'Administration'
  ));

insert into permissions (id, module, description) values
  ('departments.view', 'departments', 'View departments'),
  ('departments.manage', 'departments', 'Create/update departments')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id in ('departments.view', 'departments.manage')
    and id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('ceo', 'departments.view'), ('ceo', 'departments.manage')
on conflict do nothing;
