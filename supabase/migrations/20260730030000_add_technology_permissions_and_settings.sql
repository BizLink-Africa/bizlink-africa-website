-- Activates the Technology module's permission catalog: the dormant keys
-- seeded by 20260716000000 (dashboard.technical.view, system.health.view,
-- incidents.view/manage) plus the new keys the module's remaining pages
-- need (api_logs, webhooks, deployments, jobs, database.health, backups,
-- technology.reports, technology.settings, system.health.manage). Grants
-- the full set to 'cto' (matches its role description: "Manages technical
-- systems, integrations, AI agents, incidents") and view-only visibility to
-- 'ceo', following the same broad-read-visibility pattern used for every
-- other module CEO already sees (integrations.view, ai_agents.view, etc).

insert into permissions (id, module, description) values
  ('api_logs.view', 'api_logs', 'View API request logs'),
  ('api_logs.manage', 'api_logs', 'Record API request log entries'),
  ('webhooks.view', 'webhooks', 'View webhook delivery attempts'),
  ('webhooks.manage', 'webhooks', 'Manage webhook delivery records'),
  ('deployments.view', 'deployments', 'View deployments'),
  ('deployments.manage', 'deployments', 'Record and roll back deployments'),
  ('jobs.view', 'jobs', 'View background jobs'),
  ('jobs.manage', 'jobs', 'Manage background jobs (retry, requeue)'),
  ('database.health.view', 'database', 'View database health metrics'),
  ('database.health.manage', 'database', 'Record database health metrics'),
  ('backups.view', 'backups', 'View backup records'),
  ('backups.manage', 'backups', 'Record and manage backups'),
  ('technology.reports.view', 'technology', 'View technical reports'),
  ('technology.reports.export', 'technology', 'Export technical reports'),
  ('technology.settings.view', 'technology', 'View technology settings'),
  ('technology.settings.manage', 'technology', 'Change technology settings'),
  ('system.health.manage', 'system', 'Update platform health check status')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('cto', 'dashboard.technical.view'),
  ('cto', 'system.health.view'), ('cto', 'system.health.manage'), ('cto', 'system.logs.view'),
  ('cto', 'incidents.view'), ('cto', 'incidents.manage'),
  ('cto', 'api_logs.view'), ('cto', 'api_logs.manage'),
  ('cto', 'webhooks.view'), ('cto', 'webhooks.manage'),
  ('cto', 'deployments.view'), ('cto', 'deployments.manage'),
  ('cto', 'jobs.view'), ('cto', 'jobs.manage'),
  ('cto', 'database.health.view'), ('cto', 'database.health.manage'),
  ('cto', 'backups.view'), ('cto', 'backups.manage'),
  ('cto', 'technology.reports.view'), ('cto', 'technology.reports.export'),
  ('cto', 'technology.settings.view'), ('cto', 'technology.settings.manage'),

  ('ceo', 'dashboard.technical.view'), ('ceo', 'system.health.view'),
  ('ceo', 'incidents.view'), ('ceo', 'api_logs.view'), ('ceo', 'webhooks.view'),
  ('ceo', 'deployments.view'), ('ceo', 'jobs.view'), ('ceo', 'database.health.view'),
  ('ceo', 'backups.view'), ('ceo', 'technology.reports.view')
on conflict do nothing;

alter table company_settings
  add column if not exists uptime_target_percentage numeric not null default 99.9,
  add column if not exists api_response_time_target_ms integer not null default 500,
  add column if not exists incident_alert_email text,
  add column if not exists maintenance_mode boolean not null default false;
