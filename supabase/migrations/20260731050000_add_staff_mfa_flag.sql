-- Security Dashboard's "MFA status" KPI needs something real to read — this
-- app has no integration with Supabase Auth's per-factor MFA enrollment
-- API, so mfa_enabled is a manually-toggled flag (set on the Staff & Roles
-- page, like everything else in this app's security/compliance modules is
-- staff-recorded rather than live-verified), not a live enrollment check.
-- "Locked accounts" on the same dashboard deliberately reuses the existing
-- staff_profiles.is_active = false state rather than adding a redundant
-- lock column — an inactive staff member already cannot authenticate
-- meaningfully (is_active_staff() gates everything), so a separate lock
-- flag would just be two names for the same state.

alter table staff_profiles
  add column if not exists mfa_enabled boolean not null default false;
