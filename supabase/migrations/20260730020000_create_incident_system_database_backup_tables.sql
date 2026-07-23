-- Technical Incidents (+ timeline), System Health, Database Health, Backup Monitoring.

create table if not exists technical_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  severity text not null,
  status text not null default 'open',
  affected_systems text[] not null default '{}',
  affected_clients uuid[] not null default '{}',
  root_cause text,
  resolution text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone
);
alter table technical_incidents
  add constraint technical_incidents_severity_check check (severity in ('low', 'medium', 'high', 'critical'));
alter table technical_incidents
  add constraint technical_incidents_status_check check (status in ('open', 'investigating', 'identified', 'monitoring', 'resolved'));

create trigger technical_incidents_set_updated_at before update on technical_incidents for each row execute function set_updated_at();

alter table technical_incidents enable row level security;
create policy "incidents.view can select technical_incidents" on technical_incidents for select to authenticated using (has_permission('incidents.view'));
create policy "incidents.manage can insert technical_incidents" on technical_incidents for insert to authenticated with check (has_permission('incidents.manage'));
create policy "incidents.manage can update technical_incidents" on technical_incidents for update to authenticated using (has_permission('incidents.manage')) with check (has_permission('incidents.manage'));


create table if not exists technical_incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references technical_incidents(id) on delete cascade,
  note text not null,
  status_at_update text,
  created_by text,
  created_at timestamp with time zone not null default now()
);

alter table technical_incident_updates enable row level security;
create policy "incidents.view can select technical_incident_updates" on technical_incident_updates for select to authenticated using (has_permission('incidents.view'));
create policy "incidents.manage can insert technical_incident_updates" on technical_incident_updates for insert to authenticated with check (has_permission('incidents.manage'));
-- Deliberately no update/delete policy — timeline entries are append-only, like audit_logs.


create table if not exists system_health_checks (
  id uuid primary key default gen_random_uuid(),
  component text not null unique,
  status text not null default 'operational',
  error_rate_percentage numeric,
  detail text,
  checked_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table system_health_checks
  add constraint system_health_checks_component_check check (component in (
    'application', 'database', 'queue', 'cache', 'storage', 'scheduled_jobs'
  ));
alter table system_health_checks
  add constraint system_health_checks_status_check check (status in ('operational', 'degraded', 'down'));

create trigger system_health_checks_set_updated_at before update on system_health_checks for each row execute function set_updated_at();

insert into system_health_checks (component) values
  ('application'), ('database'), ('queue'), ('cache'), ('storage'), ('scheduled_jobs')
on conflict (component) do nothing;

alter table system_health_checks enable row level security;
create policy "system.health.view can select system_health_checks" on system_health_checks for select to authenticated using (has_permission('system.health.view'));
create policy "system.health.manage can update system_health_checks" on system_health_checks for update to authenticated using (has_permission('system.health.manage')) with check (has_permission('system.health.manage'));


create table if not exists database_health_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null,
  value numeric,
  unit text,
  status text not null default 'operational',
  recorded_at timestamp with time zone not null default now()
);
alter table database_health_metrics
  add constraint database_health_metrics_status_check check (status in ('operational', 'degraded', 'down'));

alter table database_health_metrics enable row level security;
create policy "database.health.view can select database_health_metrics" on database_health_metrics for select to authenticated using (has_permission('database.health.view'));
create policy "database.health.manage can insert database_health_metrics" on database_health_metrics for insert to authenticated with check (has_permission('database.health.manage'));
create policy "database.health.manage can update database_health_metrics" on database_health_metrics for update to authenticated using (has_permission('database.health.manage')) with check (has_permission('database.health.manage'));


create table if not exists backup_records (
  id uuid primary key default gen_random_uuid(),
  system text not null,
  backup_type text not null default 'automated',
  status text not null default 'scheduled',
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  size_mb numeric,
  location text,
  next_scheduled_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);
alter table backup_records
  add constraint backup_records_type_check check (backup_type in ('automated', 'manual'));
alter table backup_records
  add constraint backup_records_status_check check (status in ('scheduled', 'running', 'completed', 'failed'));

alter table backup_records enable row level security;
create policy "backups.view can select backup_records" on backup_records for select to authenticated using (has_permission('backups.view'));
create policy "backups.manage can insert backup_records" on backup_records for insert to authenticated with check (has_permission('backups.manage'));
create policy "backups.manage can update backup_records" on backup_records for update to authenticated using (has_permission('backups.manage')) with check (has_permission('backups.manage'));
