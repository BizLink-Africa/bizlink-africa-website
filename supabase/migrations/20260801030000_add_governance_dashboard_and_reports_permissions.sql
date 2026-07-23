-- Governance-specific permissions for the Dashboard, Reports & Analytics,
-- Governance Reports, and Audit Summary pages. Roles & Permissions,
-- Policies, Departments, Approval Workflows, and Staff Access Reviews reuse
-- roles.*/policies.*/departments.*/approval_workflows.*/access_reviews.* —
-- these five are net new because nothing existing covers them.

insert into permissions (id, module, description) values
  ('dashboard.governance.view', 'dashboard', 'View Governance Dashboard'),
  ('governance.analytics.view', 'governance', 'View cross-department Reports & Analytics'),
  ('governance.analytics.export', 'governance', 'Export cross-department analytics'),
  ('governance.reports.view', 'governance', 'View Governance Reports'),
  ('governance.reports.export', 'governance', 'Export Governance Reports'),
  ('governance.audit.view', 'governance', 'View the Governance Audit Summary')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id in (
    'dashboard.governance.view', 'governance.analytics.view', 'governance.analytics.export',
    'governance.reports.view', 'governance.reports.export', 'governance.audit.view'
  )
  and id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('ceo', 'dashboard.governance.view'),
  ('ceo', 'governance.analytics.view'), ('ceo', 'governance.analytics.export'),
  ('ceo', 'governance.reports.view'), ('ceo', 'governance.reports.export'),
  ('ceo', 'governance.audit.view'),
  ('compliance_security', 'governance.audit.view')
on conflict do nothing;
