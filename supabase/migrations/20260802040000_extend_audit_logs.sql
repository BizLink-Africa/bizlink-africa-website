-- Audit Logs: "Result" and "Record type" filters.
--
-- result: defaults to 'success' (matches every existing row and every
-- existing call site, none of which need to change). The one place this
-- becomes meaningful is requirePermission() now also logging a 'failure'
-- row on every permission denial (see src/lib/supabase/dal.ts) — this is
-- also the real answer to "TEST: Unauthorized settings access": every
-- denied attempt at a gated page/action is now an audit_logs row, not a
-- silent redirect.
--
-- record_type: a coarser grouping than `module` (e.g. 'roles'/
-- 'role_permissions'/'departments'/'approval_workflows' all become
-- 'governance'), auto-derived from `module` inside logAuditEvent() itself
-- (src/lib/audit.ts) — no caller anywhere needed to change.
--
-- "Role" and "User" filters need no new column: the Audit Logs page joins
-- performed_by (email) against staff_profiles at query time instead — this
-- deliberately shows the CURRENT role of whoever performed an action, not
-- a role-at-time-of-action snapshot (unlike access_reviews' point-in-time
-- design) — capturing role-at-time would require touching every one of
-- this app's ~40 logAuditEvent() call sites, which is out of scope here.

alter table audit_logs
  add column if not exists result text not null default 'success',
  add column if not exists record_type text not null default 'general';

alter table audit_logs
  add constraint audit_logs_result_check check (result in ('success', 'failure'));
