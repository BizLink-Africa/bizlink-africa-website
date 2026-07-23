-- Operations Reports: cross-module reporting (onboarding, contracts,
-- projects, tasks) surfaced under the Operations nav group, alongside
-- Finance/CRM's existing per-module reports pages.

insert into permissions (id, module, description) values
  ('operations.reports.view', 'operations', 'View Operations reports'),
  ('operations.reports.export', 'operations', 'Export Operations reports')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'operations.reports.view'), ('super_admin', 'operations.reports.export'),
  ('operations', 'operations.reports.view'), ('operations', 'operations.reports.export'),
  ('ceo', 'operations.reports.view')
on conflict do nothing;
