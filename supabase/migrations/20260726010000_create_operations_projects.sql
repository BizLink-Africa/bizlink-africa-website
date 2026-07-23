-- Projects + Delivery Milestones: tracks implementation work per client
-- (one project per client/service/contract engagement), its team, and the
-- milestones within it. Separate from client_services.delivery_status
-- (which tracks a single service's rollout state) — a project is the
-- broader unit of work, and can span multiple services.

-- ============================================================
-- 1. New permissions
-- ============================================================

insert into permissions (id, module, description) values
  ('projects.view', 'projects', 'View projects and delivery milestones'),
  ('projects.manage', 'projects', 'Create/update projects and delivery milestones'),
  ('service_delivery.view', 'service_delivery', 'View service delivery projects/milestones (Operations module)'),
  ('service_delivery.manage', 'service_delivery', 'Manage service delivery projects/milestones (Operations module)')
on conflict (id) do nothing;

-- ============================================================
-- 2. projects
-- ============================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null unique,
  project_name text not null,

  client_id uuid references clients(id) on delete set null,
  service_key text,
  contract_id uuid references contracts(id) on delete set null,
  project_owner uuid references staff_profiles(id) on delete set null,

  status text not null default 'planned',
  start_date date,
  target_completion_date date,
  completion_date date,
  progress int not null default 0,

  risks text,
  blockers text,
  notes text,

  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table projects
  add constraint projects_status_check check (status in (
    'planned', 'in_progress', 'on_hold', 'delayed', 'completed', 'cancelled'
  ));
alter table projects
  add constraint projects_progress_check check (progress >= 0 and progress <= 100);

create trigger projects_set_updated_at
  before update on projects
  for each row
  execute function set_updated_at();

alter table projects enable row level security;
create policy "projects.view can select projects" on projects for select to authenticated using (has_permission('projects.view'));
create policy "projects.manage can insert projects" on projects for insert to authenticated with check (has_permission('projects.manage'));
create policy "projects.manage can update projects" on projects for update to authenticated using (has_permission('projects.manage')) with check (has_permission('projects.manage'));

-- ============================================================
-- 3. project_team_members
-- ============================================================

create table if not exists project_team_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  role_on_project text,
  created_at timestamp with time zone not null default now(),
  unique (project_id, staff_id)
);

alter table project_team_members enable row level security;
create policy "projects.view can select project_team_members" on project_team_members for select to authenticated using (has_permission('projects.view'));
create policy "projects.manage can insert project_team_members" on project_team_members for insert to authenticated with check (has_permission('projects.manage'));
create policy "projects.manage can delete project_team_members" on project_team_members for delete to authenticated using (has_permission('projects.manage'));

-- ============================================================
-- 4. project_milestones (Delivery Milestones)
-- ============================================================

create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  owner uuid references staff_profiles(id) on delete set null,
  due_date date,
  completion_date date,
  status text not null default 'pending',
  dependencies text[] not null default '{}',
  acceptance_requirement text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table project_milestones
  add constraint project_milestones_status_check check (status in (
    'pending', 'in_progress', 'completed', 'delayed', 'blocked'
  ));

create trigger project_milestones_set_updated_at
  before update on project_milestones
  for each row
  execute function set_updated_at();

alter table project_milestones enable row level security;
create policy "projects.view can select project_milestones" on project_milestones for select to authenticated using (has_permission('projects.view'));
create policy "projects.manage can insert project_milestones" on project_milestones for insert to authenticated with check (has_permission('projects.manage'));
create policy "projects.manage can update project_milestones" on project_milestones for update to authenticated using (has_permission('projects.manage')) with check (has_permission('projects.manage'));

-- ============================================================
-- 5. Role grants
-- ============================================================

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'projects.view'), ('super_admin', 'projects.manage'),
  ('super_admin', 'service_delivery.view'), ('super_admin', 'service_delivery.manage'),
  ('operations', 'projects.view'), ('operations', 'projects.manage'),
  ('operations', 'service_delivery.view'), ('operations', 'service_delivery.manage'),
  ('ceo', 'projects.view'), ('ceo', 'service_delivery.view')
on conflict do nothing;
