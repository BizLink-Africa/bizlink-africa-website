-- Extends support_tickets from its Phase 1 shape (title/category/priority/
-- status/free-text assigned_staff) to the full Customer Support model:
-- richer ticket fields, a real assigned_user_id FK (assigned_staff stays
-- for backward compat, same "add the FK, keep the legacy column" pattern
-- used for leads/clients in the CRM migration), department ownership,
-- escalation to one of 5 executive targets, links into the existing
-- client_services/integration_health/ai_agent_configs tables, and SLA
-- deadline timestamps (the deadlines themselves are set by application
-- code from support_sla_rules — see the next-but-one migration — not
-- computed here).

alter table support_tickets add column if not exists ticket_number text unique;
alter table support_tickets add column if not exists description text;
alter table support_tickets add column if not exists contact_person text;
alter table support_tickets add column if not exists contact_email text;
alter table support_tickets add column if not exists related_service_id uuid references client_services(id) on delete set null;
alter table support_tickets add column if not exists assigned_user_id uuid references staff_profiles(id) on delete set null;
alter table support_tickets add column if not exists department text;
alter table support_tickets add column if not exists escalated_to text;
alter table support_tickets add column if not exists escalation_reason text;
alter table support_tickets add column if not exists escalated_at timestamp with time zone;
alter table support_tickets add column if not exists related_integration_id uuid references integration_health(id) on delete set null;
alter table support_tickets add column if not exists related_ai_agent_id uuid references ai_agent_configs(id) on delete set null;
alter table support_tickets add column if not exists response_deadline timestamp with time zone;
alter table support_tickets add column if not exists resolution_deadline timestamp with time zone;
alter table support_tickets add column if not exists first_response_at timestamp with time zone;
alter table support_tickets add column if not exists resolved_at timestamp with time zone;
alter table support_tickets add column if not exists reopened_count int not null default 0;

do $$
declare
  t record;
begin
  for t in select id from support_tickets where ticket_number is null order by created_at loop
    update support_tickets set ticket_number = next_finance_number('TCK') where id = t.id;
  end loop;
end $$;

alter table support_tickets
  add constraint support_tickets_department_check check (department is null or department in (
    'operations', 'technology', 'finance', 'compliance_security', 'executive', 'customer_support'
  ));
alter table support_tickets
  add constraint support_tickets_escalated_to_check check (escalated_to is null or escalated_to in (
    'operations', 'cto', 'cfo', 'compliance_security', 'ceo'
  ));

alter table support_tickets drop constraint if exists support_tickets_status_check;
alter table support_tickets
  add constraint support_tickets_status_check check (status in (
    'new', 'open', 'in_progress', 'waiting_client', 'waiting_internal',
    'escalated', 'resolved', 'closed', 'reopened'
  ));
