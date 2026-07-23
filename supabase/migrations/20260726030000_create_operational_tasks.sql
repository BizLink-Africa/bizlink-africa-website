-- Operational Tasks: general-purpose task tracking for Operations work that
-- isn't itself an onboarding case, contract, project, or service delivery
-- record — day-to-day to-dos that may still reference any of those.

insert into permissions (id, module, description) values
  ('operations.tasks.view', 'operations', 'View operational tasks'),
  ('operations.tasks.manage', 'operations', 'Create/update operational tasks')
on conflict (id) do nothing;

create table if not exists operational_tasks (
  id uuid primary key default gen_random_uuid(),
  task_number text not null unique,
  title text not null,
  description text,

  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  assigned_user_id uuid references staff_profiles(id) on delete set null,
  department text,

  priority text not null default 'normal',
  due_date date,
  status text not null default 'todo',
  blocker text,
  notes text,

  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table operational_tasks
  add constraint operational_tasks_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));
alter table operational_tasks
  add constraint operational_tasks_status_check check (status in (
    'todo', 'in_progress', 'blocked', 'completed', 'cancelled'
  ));

create trigger operational_tasks_set_updated_at
  before update on operational_tasks
  for each row
  execute function set_updated_at();

alter table operational_tasks enable row level security;
create policy "operations.tasks.view can select operational_tasks" on operational_tasks for select to authenticated using (has_permission('operations.tasks.view'));
create policy "operations.tasks.manage can insert operational_tasks" on operational_tasks for insert to authenticated with check (has_permission('operations.tasks.manage'));
create policy "operations.tasks.manage can update operational_tasks" on operational_tasks for update to authenticated using (has_permission('operations.tasks.manage')) with check (has_permission('operations.tasks.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'operations.tasks.view'), ('super_admin', 'operations.tasks.manage'),
  ('operations', 'operations.tasks.view'), ('operations', 'operations.tasks.manage'),
  ('ceo', 'operations.tasks.view')
on conflict do nothing;
