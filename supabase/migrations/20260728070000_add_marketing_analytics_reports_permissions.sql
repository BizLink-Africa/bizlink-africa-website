-- Campaign Analytics + Marketing Reports permissions.

insert into permissions (id, module, description) values
  ('marketing.analytics.view', 'marketing', 'View Campaign Analytics'),
  ('marketing.reports.view', 'marketing', 'View Marketing Reports'),
  ('marketing.reports.export', 'marketing', 'Export Marketing Reports')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'marketing.analytics.view'), ('super_admin', 'marketing.reports.view'), ('super_admin', 'marketing.reports.export'),
  ('marketing', 'marketing.analytics.view'), ('marketing', 'marketing.reports.view'), ('marketing', 'marketing.reports.export'),
  ('ceo', 'marketing.analytics.view'), ('ceo', 'marketing.reports.view')
on conflict do nothing;
