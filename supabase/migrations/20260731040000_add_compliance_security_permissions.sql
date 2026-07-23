-- Activates the remaining Compliance & Security module permissions —
-- compliance.*/security.*/dashboard.compliance.view already exist and were
-- granted in 20260723010000_create_compliance_security_module.sql; this
-- adds the granular per-page keys the rest of the spec's pages need, kept
-- deliberately separate (compliance.* vs security.* namespaces) rather than
-- reusing the two broad flags for everything, so a role can hold compliance
-- capability without security capability or vice versa.

insert into permissions (id, module, description) values
  ('client_compliance.view', 'compliance', 'View client compliance records'),
  ('client_compliance.manage', 'compliance', 'Manage client compliance records'),
  ('contract_compliance.view', 'compliance', 'View contract compliance records'),
  ('contract_compliance.manage', 'compliance', 'Manage contract compliance records'),
  ('data_protection.view', 'compliance', 'View data protection processing activities'),
  ('data_protection.manage', 'compliance', 'Manage data protection processing activities'),
  ('policies.view', 'compliance', 'View policies'),
  ('policies.manage', 'compliance', 'Create/update policies'),
  ('policies.acknowledge', 'compliance', 'Acknowledge a policy on your own behalf'),
  ('access_reviews.view', 'compliance', 'View access reviews'),
  ('access_reviews.manage', 'compliance', 'Record access review decisions'),
  ('compliance.reports.view', 'compliance', 'View compliance reports'),
  ('compliance.reports.export', 'compliance', 'Export compliance reports'),

  ('dashboard.security.view', 'dashboard', 'View Security Dashboard'),
  ('security_incidents.view', 'security', 'View security incidents'),
  ('security_incidents.manage', 'security', 'Manage security incidents'),
  ('sessions.view', 'security', 'View tracked user sessions'),
  ('sessions.manage', 'security', 'Revoke tracked user sessions'),
  ('logins.view', 'security', 'View login activity'),
  ('security.reports.view', 'security', 'View security reports'),
  ('security.reports.export', 'security', 'Export security reports')
on conflict (id) do nothing;

-- Safety-net backfill: super_admin is meant to hold every permission in the
-- catalog (see 20260716000000_create_rbac_foundation.sql section 4 comment:
-- "super_admin gets everything"), via a one-time blanket insert-select at
-- seed time. Every migration since that has added new permission rows
-- (including this project's own 20260730030000_add_technology_permissions_and_settings.sql)
-- forgot to repeat that insert-select, so super_admin silently fell behind
-- on every module shipped after the seed. has_permission() has no
-- super_admin bypass — it is purely role_permissions-driven — so this was a
-- real access gap, not just a hygiene issue. Backfills everything missing
-- (Technology's permissions included), and this migration's own new
-- permissions below.
insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  ('compliance_security', 'client_compliance.view'), ('compliance_security', 'client_compliance.manage'),
  ('compliance_security', 'contract_compliance.view'), ('compliance_security', 'contract_compliance.manage'),
  ('compliance_security', 'data_protection.view'), ('compliance_security', 'data_protection.manage'),
  ('compliance_security', 'policies.view'), ('compliance_security', 'policies.manage'), ('compliance_security', 'policies.acknowledge'),
  ('compliance_security', 'access_reviews.view'), ('compliance_security', 'access_reviews.manage'),
  ('compliance_security', 'compliance.reports.view'), ('compliance_security', 'compliance.reports.export'),
  ('compliance_security', 'dashboard.security.view'),
  ('compliance_security', 'security_incidents.view'), ('compliance_security', 'security_incidents.manage'),
  ('compliance_security', 'sessions.view'), ('compliance_security', 'sessions.manage'),
  ('compliance_security', 'logins.view'),
  ('compliance_security', 'security.reports.view'), ('compliance_security', 'security.reports.export'),

  ('ceo', 'client_compliance.view'), ('ceo', 'contract_compliance.view'), ('ceo', 'data_protection.view'),
  ('ceo', 'policies.view'), ('ceo', 'access_reviews.view'), ('ceo', 'compliance.reports.view'),
  ('ceo', 'dashboard.security.view'), ('ceo', 'security_incidents.view'), ('ceo', 'sessions.view'),
  ('ceo', 'logins.view'), ('ceo', 'security.reports.view'),

  -- Every active staff member (any role) can acknowledge policies for
  -- themselves — this is a personal obligation, not a compliance-officer
  -- capability. Explicit per-role grants rather than a blanket policy, so
  -- future roles must opt in deliberately like everything else in this table.
  ('super_admin', 'policies.acknowledge'), ('ceo', 'policies.acknowledge'), ('cfo', 'policies.acknowledge'),
  ('cto', 'policies.acknowledge'), ('operations', 'policies.acknowledge'),
  ('customer_support', 'policies.acknowledge'), ('marketing', 'policies.acknowledge')
on conflict do nothing;

alter table company_settings
  add column if not exists compliance_alert_email text;
