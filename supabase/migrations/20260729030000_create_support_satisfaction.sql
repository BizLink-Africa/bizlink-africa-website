-- Customer Satisfaction: one rating+feedback record per ticket, recorded by
-- staff after gathering it (phone/email/WhatsApp) — there is no live
-- client-facing survey mechanism in this codebase to submit these
-- automatically.

insert into permissions (id, module, description) values
  ('csat.view', 'csat', 'View customer satisfaction ratings'),
  ('csat.manage', 'csat', 'Record customer satisfaction ratings')
on conflict (id) do nothing;

create table if not exists support_ticket_satisfaction (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references support_tickets(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  agent_user_id uuid references staff_profiles(id) on delete set null,
  rating int not null,
  feedback text,
  created_by text,
  created_at timestamp with time zone not null default now()
);

alter table support_ticket_satisfaction
  add constraint support_ticket_satisfaction_rating_check check (rating >= 1 and rating <= 5);

alter table support_ticket_satisfaction enable row level security;
create policy "csat.view can select support_ticket_satisfaction" on support_ticket_satisfaction for select to authenticated using (has_permission('csat.view'));
create policy "csat.manage can insert support_ticket_satisfaction" on support_ticket_satisfaction for insert to authenticated with check (has_permission('csat.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'csat.view'), ('super_admin', 'csat.manage'),
  ('customer_support', 'csat.view'), ('customer_support', 'csat.manage'),
  ('ceo', 'csat.view')
on conflict do nothing;
