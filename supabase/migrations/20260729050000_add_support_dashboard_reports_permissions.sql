-- Activates the dormant dashboard.support.view permission (seeded but
-- never granted to a real role) and adds Support Reports permissions,
-- matching the finance.reports.*/marketing.reports.* precedent.

insert into permissions (id, module, description) values
  ('support.reports.view', 'support', 'View Support Reports'),
  ('support.reports.export', 'support', 'Export Support Reports')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'support.reports.view'), ('super_admin', 'support.reports.export'),
  ('customer_support', 'dashboard.support.view'),
  ('customer_support', 'support.reports.view'), ('customer_support', 'support.reports.export'),
  ('ceo', 'dashboard.support.view'), ('ceo', 'support.reports.view')
on conflict do nothing;
