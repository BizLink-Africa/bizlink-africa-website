-- SLA rules: one row per priority, editable from the new Support Settings
-- page — same idea as Finance's editable expense_high_value_threshold.
-- Deadlines on individual tickets (support_tickets.response_deadline/
-- resolution_deadline) are computed from these hours at ticket creation/
-- priority-change time by application code, not derived live on every
-- read — a ticket's deadline must stay fixed even if the SLA rule for its
-- priority changes later.

insert into permissions (id, module, description) values
  ('support.settings.view', 'support', 'View support settings (SLA rules)'),
  ('support.settings.manage', 'support', 'Change support settings (SLA rules)')
on conflict (id) do nothing;

create table if not exists support_sla_rules (
  priority text primary key,
  response_hours int not null,
  resolution_hours int not null,
  updated_at timestamp with time zone not null default now()
);

alter table support_sla_rules
  add constraint support_sla_rules_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));

create trigger support_sla_rules_set_updated_at
  before update on support_sla_rules
  for each row
  execute function set_updated_at();

insert into support_sla_rules (priority, response_hours, resolution_hours) values
  ('urgent', 1, 4),
  ('high', 4, 24),
  ('normal', 8, 48),
  ('low', 24, 72)
on conflict (priority) do nothing;

alter table support_sla_rules enable row level security;
create policy "support.settings.view can select support_sla_rules" on support_sla_rules for select to authenticated using (has_permission('support.settings.view'));
create policy "support.settings.manage can update support_sla_rules" on support_sla_rules for update to authenticated using (has_permission('support.settings.manage')) with check (has_permission('support.settings.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'support.settings.view'), ('super_admin', 'support.settings.manage'),
  ('customer_support', 'support.settings.view'), ('customer_support', 'support.settings.manage'),
  ('ceo', 'support.settings.view')
on conflict do nothing;
