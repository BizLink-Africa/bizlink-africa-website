-- Resource Allocation: how much of each staff member's capacity is
-- committed to which project. "Current workload" and "delivery conflicts"
-- are computed at query time (sum of a staff member's active allocations
-- vs. their capacity_percent) rather than stored, so they can never drift
-- out of sync with the underlying allocation rows.

insert into permissions (id, module, description) values
  ('resources.view', 'resources', 'View staff resource allocation'),
  ('resources.manage', 'resources', 'Create/update staff resource allocation')
on conflict (id) do nothing;

alter table staff_profiles add column if not exists capacity_percent int not null default 100;
alter table staff_profiles
  add constraint staff_profiles_capacity_percent_check check (capacity_percent >= 0 and capacity_percent <= 100);

create table if not exists resource_allocations (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  allocation_percent int not null,
  start_date date,
  end_date date,
  notes text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table resource_allocations
  add constraint resource_allocations_percent_check check (allocation_percent > 0 and allocation_percent <= 100);

create trigger resource_allocations_set_updated_at
  before update on resource_allocations
  for each row
  execute function set_updated_at();

alter table resource_allocations enable row level security;
create policy "resources.view can select resource_allocations" on resource_allocations for select to authenticated using (has_permission('resources.view'));
create policy "resources.manage can insert resource_allocations" on resource_allocations for insert to authenticated with check (has_permission('resources.manage'));
create policy "resources.manage can update resource_allocations" on resource_allocations for update to authenticated using (has_permission('resources.manage')) with check (has_permission('resources.manage'));
create policy "resources.manage can delete resource_allocations" on resource_allocations for delete to authenticated using (has_permission('resources.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'resources.view'), ('super_admin', 'resources.manage'),
  ('operations', 'resources.view'), ('operations', 'resources.manage'),
  ('ceo', 'resources.view')
on conflict do nothing;
