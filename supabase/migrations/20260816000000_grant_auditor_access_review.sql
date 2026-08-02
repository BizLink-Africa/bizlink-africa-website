-- The new Role & Privileged Access Review page (see
-- src/app/admin/(protected)/governance/access-review/page.tsx) is gated on
-- access_reviews.view, the same permission already backing the adjacent
-- "Staff Access Reviews" page. That permission predates the Auditor role's
-- expansion in 20260815000000_extend_rbac_finance_operations.sql and was
-- only ever granted to compliance_security/ceo/super_admin. "Auditor is
-- read-only" (this task's own rule) is exactly the access this page
-- provides, so extend it — additive only, no other grant is touched.
insert into role_permissions (role_id, permission_id) values
  ('auditor', 'access_reviews.view')
on conflict do nothing;
