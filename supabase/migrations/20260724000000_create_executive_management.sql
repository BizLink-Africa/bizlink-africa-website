-- Executive Management: new executive.* permission namespace, plus one new
-- table (executive_follow_ups) for the two genuinely cross-cutting concepts
-- the Executive Action Center needs that don't belong to any single domain
-- table — "assign follow-up" and "escalate". Real approve/reject decisions
-- deliberately do NOT get a new table: every domain (contracts, expenses,
-- proformas, compliance reviews, security events) already owns its own
-- status column + action, and the Action Center reuses those directly so
-- there is never a second source of truth for the same decision.

-- ============================================================
-- 1. Permissions
-- ============================================================

insert into permissions (id, module, description) values
  ('executive.actions.view', 'executive', 'View the Executive Action Center'),
  ('executive.actions.manage', 'executive', 'Comment, assign follow-up, or escalate executive action items'),
  ('executive.approvals.view', 'executive', 'View the Pending Approvals page'),
  ('executive.approvals.manage', 'executive', 'Act on items from the Pending Approvals page'),
  ('executive.reports.view', 'executive', 'View Executive Reports'),
  ('executive.reports.export', 'executive', 'Export Executive Reports'),
  ('executive.alerts.view', 'executive', 'View Company Alerts')
on conflict (id) do nothing;

-- New permissions always need an explicit super_admin grant — the
-- "super_admin gets every existing permission" bulk insert in the RBAC
-- foundation migration already ran once and only covered what existed then
-- (see the governance_module migration for the same pattern).
insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'executive.actions.view'), ('super_admin', 'executive.actions.manage'),
  ('super_admin', 'executive.approvals.view'), ('super_admin', 'executive.approvals.manage'),
  ('super_admin', 'executive.reports.view'), ('super_admin', 'executive.reports.export'),
  ('super_admin', 'executive.alerts.view'),
  ('ceo', 'executive.actions.view'), ('ceo', 'executive.actions.manage'),
  ('ceo', 'executive.approvals.view'), ('ceo', 'executive.approvals.manage'),
  ('ceo', 'executive.reports.view'), ('ceo', 'executive.reports.export'),
  ('ceo', 'executive.alerts.view')
on conflict do nothing;

-- ============================================================
-- 2. executive_follow_ups
-- ============================================================

create table if not exists executive_follow_ups (
  id uuid primary key default gen_random_uuid(),
  source_module text not null,
  source_id uuid not null,
  action_type text not null,
  assigned_to text,
  priority text not null default 'normal',
  deadline date,
  note text,
  status text not null default 'open',
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table executive_follow_ups
  add constraint executive_follow_ups_action_type_check check (action_type in ('assign', 'escalate'));

alter table executive_follow_ups
  add constraint executive_follow_ups_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));

alter table executive_follow_ups
  add constraint executive_follow_ups_status_check check (status in ('open', 'done'));

create trigger executive_follow_ups_set_updated_at
  before update on executive_follow_ups
  for each row
  execute function set_updated_at();

alter table executive_follow_ups enable row level security;
create policy "executive.actions.view or executive.approvals.view can select follow-ups" on executive_follow_ups
  for select to authenticated using (has_permission('executive.actions.view') or has_permission('executive.approvals.view'));
create policy "executive.actions.manage or executive.approvals.manage can insert follow-ups" on executive_follow_ups
  for insert to authenticated with check (has_permission('executive.actions.manage') or has_permission('executive.approvals.manage'));
create policy "executive.actions.manage or executive.approvals.manage can update follow-ups" on executive_follow_ups
  for update to authenticated
  using (has_permission('executive.actions.manage') or has_permission('executive.approvals.manage'))
  with check (has_permission('executive.actions.manage') or has_permission('executive.approvals.manage'));
