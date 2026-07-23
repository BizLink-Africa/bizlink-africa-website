-- API Monitoring, Webhook Monitoring, Deployment Management, Background Jobs.
-- api_request_logs deliberately has no column capable of holding a secret
-- (no raw headers/body/query-string column) — "never show full secrets" is
-- enforced by not storing them in the first place, plus src/lib/security/mask.ts
-- defensively masks any secret-shaped substrings that end up in free-text
-- fields (endpoint, error detail) before they're rendered.

create table if not exists api_request_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamp with time zone not null default now(),
  client_id uuid references clients(id) on delete set null,
  endpoint text not null,
  method text not null,
  response_code integer not null,
  response_time_ms integer,
  correlation_id text,
  error_category text not null default 'none',
  retry_count integer not null default 0,
  environment text not null default 'production',
  created_at timestamp with time zone not null default now()
);
alter table api_request_logs
  add constraint api_request_logs_method_check check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'));
alter table api_request_logs
  add constraint api_request_logs_error_category_check check (error_category in (
    'none', 'validation', 'authentication', 'rate_limit', 'upstream', 'timeout', 'server_error'
  ));
alter table api_request_logs
  add constraint api_request_logs_environment_check check (environment in ('production', 'staging', 'sandbox'));

alter table api_request_logs enable row level security;
create policy "api_logs.view can select api_request_logs" on api_request_logs for select to authenticated using (has_permission('api_logs.view'));
create policy "api_logs.manage can insert api_request_logs" on api_request_logs for insert to authenticated with check (has_permission('api_logs.manage'));


create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  endpoint text not null,
  event text not null,
  delivery_status text not null default 'pending',
  response_summary text,
  retry_count integer not null default 0,
  failure_reason text,
  next_retry_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table webhook_deliveries
  add constraint webhook_deliveries_status_check check (delivery_status in ('pending', 'delivered', 'failed', 'retrying'));

create trigger webhook_deliveries_set_updated_at before update on webhook_deliveries for each row execute function set_updated_at();

alter table webhook_deliveries enable row level security;
create policy "webhooks.view can select webhook_deliveries" on webhook_deliveries for select to authenticated using (has_permission('webhooks.view'));
create policy "webhooks.manage can insert webhook_deliveries" on webhook_deliveries for insert to authenticated with check (has_permission('webhooks.manage'));
create policy "webhooks.manage can update webhook_deliveries" on webhook_deliveries for update to authenticated using (has_permission('webhooks.manage')) with check (has_permission('webhooks.manage'));


create table if not exists deployments (
  id uuid primary key default gen_random_uuid(),
  application text not null,
  environment text not null default 'production',
  version text not null,
  status text not null default 'pending',
  started_by text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  result text,
  rollback_status text not null default 'not_required',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table deployments
  add constraint deployments_environment_check check (environment in ('production', 'staging', 'sandbox'));
alter table deployments
  add constraint deployments_status_check check (status in ('pending', 'in_progress', 'success', 'failed', 'rolled_back'));
alter table deployments
  add constraint deployments_rollback_status_check check (rollback_status in ('not_required', 'pending', 'in_progress', 'completed', 'failed'));

create trigger deployments_set_updated_at before update on deployments for each row execute function set_updated_at();

alter table deployments enable row level security;
create policy "deployments.view can select deployments" on deployments for select to authenticated using (has_permission('deployments.view'));
create policy "deployments.manage can insert deployments" on deployments for insert to authenticated with check (has_permission('deployments.manage'));
create policy "deployments.manage can update deployments" on deployments for update to authenticated using (has_permission('deployments.manage')) with check (has_permission('deployments.manage'));


create table if not exists background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  queue text not null default 'default',
  status text not null default 'queued',
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  retries integer not null default 0,
  failure_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table background_jobs
  add constraint background_jobs_status_check check (status in ('queued', 'running', 'completed', 'failed', 'retrying'));

create trigger background_jobs_set_updated_at before update on background_jobs for each row execute function set_updated_at();

alter table background_jobs enable row level security;
create policy "jobs.view can select background_jobs" on background_jobs for select to authenticated using (has_permission('jobs.view'));
create policy "jobs.manage can insert background_jobs" on background_jobs for insert to authenticated with check (has_permission('jobs.manage'));
create policy "jobs.manage can update background_jobs" on background_jobs for update to authenticated using (has_permission('jobs.manage')) with check (has_permission('jobs.manage'));
