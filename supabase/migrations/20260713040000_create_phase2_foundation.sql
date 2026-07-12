-- Schema-only foundation for the modules that get their Super Admin UI in a
-- later phase: Support Tickets, Integration Health, AI Agent Management,
-- Staff & Roles, Audit Logs. Nothing writes to these tables yet — they
-- exist now so Phase 2 needs no further migrations, and so Phase 1's
-- overview counts and client detail "empty state" queries already work
-- against real (currently empty) tables instead of placeholders.

create table if not exists staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table staff_profiles
  add constraint staff_profiles_role_check check (role in (
    'super_admin', 'admin', 'sales_staff', 'technical_staff', 'support_staff', 'compliance_officer'
  ));
alter table staff_profiles enable row level security;
create policy "Authenticated can view staff profiles"
  on staff_profiles for select to authenticated using (true);
create policy "Authenticated can insert staff profiles"
  on staff_profiles for insert to authenticated with check (true);
create policy "Authenticated can update staff profiles"
  on staff_profiles for update to authenticated using (true) with check (true);
create trigger staff_profiles_set_updated_at
  before update on staff_profiles for each row execute function set_updated_at();


create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  title text not null,
  category text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  assigned_staff text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table support_tickets
  add constraint support_tickets_category_check check (category in (
    'technical', 'integration', 'ai_agent', 'social_commerce', 'payment_integration_support', 'website', 'other'
  ));
alter table support_tickets
  add constraint support_tickets_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));
alter table support_tickets
  add constraint support_tickets_status_check check (status in (
    'open', 'in_progress', 'waiting_client', 'resolved', 'closed'
  ));
alter table support_tickets enable row level security;
create policy "Authenticated can view support tickets"
  on support_tickets for select to authenticated using (true);
create policy "Authenticated can insert support tickets"
  on support_tickets for insert to authenticated with check (true);
create policy "Authenticated can update support tickets"
  on support_tickets for update to authenticated using (true) with check (true);
create trigger support_tickets_set_updated_at
  before update on support_tickets for each row execute function set_updated_at();


create table if not exists support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author text not null,
  message text not null,
  created_at timestamp with time zone not null default now()
);
alter table support_ticket_messages enable row level security;
create policy "Authenticated can view ticket messages"
  on support_ticket_messages for select to authenticated using (true);
create policy "Authenticated can insert ticket messages"
  on support_ticket_messages for insert to authenticated with check (true);


create table if not exists integration_health (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  service_type text not null,
  api_status text not null default 'pending_setup',
  webhook_endpoint text,
  last_successful_request timestamp with time zone,
  last_failed_request timestamp with time zone,
  error_message text,
  payment_partner_routing_status text,
  ai_agent_status text,
  social_commerce_bot_status text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table integration_health
  add constraint integration_health_api_status_check check (api_status in (
    'active', 'warning', 'failed', 'pending_setup', 'disabled'
  ));
alter table integration_health enable row level security;
create policy "Authenticated can view integration health"
  on integration_health for select to authenticated using (true);
create policy "Authenticated can insert integration health"
  on integration_health for insert to authenticated with check (true);
create policy "Authenticated can update integration health"
  on integration_health for update to authenticated using (true) with check (true);
create trigger integration_health_set_updated_at
  before update on integration_health for each row execute function set_updated_at();


create table if not exists ai_agent_configs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  agent_type text not null,
  agent_status text not null default 'pending_setup',
  business_hours text,
  knowledge_base_status text not null default 'not_started',
  products_configured boolean not null default false,
  human_handover_contact text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table ai_agent_configs
  add constraint ai_agent_configs_agent_type_check check (agent_type in ('sales_agent', 'customer_care_agent'));
alter table ai_agent_configs
  add constraint ai_agent_configs_agent_status_check check (agent_status in (
    'active', 'warning', 'failed', 'pending_setup', 'disabled'
  ));
alter table ai_agent_configs enable row level security;
create policy "Authenticated can view ai agent configs"
  on ai_agent_configs for select to authenticated using (true);
create policy "Authenticated can insert ai agent configs"
  on ai_agent_configs for insert to authenticated with check (true);
create policy "Authenticated can update ai agent configs"
  on ai_agent_configs for update to authenticated using (true) with check (true);
create trigger ai_agent_configs_set_updated_at
  before update on ai_agent_configs for each row execute function set_updated_at();


create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  performed_by text not null,
  action_type text not null,
  module text not null,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone not null default now()
);
alter table audit_logs enable row level security;
create policy "Authenticated can view audit logs"
  on audit_logs for select to authenticated using (true);
create policy "Authenticated can insert audit logs"
  on audit_logs for insert to authenticated with check (true);
-- Deliberately no update/delete policy — audit entries are append-only.
