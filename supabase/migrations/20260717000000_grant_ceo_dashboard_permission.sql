-- The RBAC foundation migration seeded 'dashboard.ceo.view' as a dormant
-- permission (no dashboard existed yet to gate). Now that the CEO Dashboard
-- is being built, grant it to the ceo role. super_admin already has every
-- permission from the foundation migration.

insert into role_permissions (role_id, permission_id) values
  ('ceo', 'dashboard.ceo.view')
on conflict do nothing;
