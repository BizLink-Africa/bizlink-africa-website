-- Onboarding Pipeline: a richer, stage-based case per lead/client moving
-- through the full BizLink Africa onboarding journey (20 stages, New
-- Inquiry -> Activated/On Hold/Rejected). Purely additive alongside the
-- existing onboarding_checklists table (a flat 10-item checklist embedded
-- on lead/client detail pages) — neither replaces the other, and
-- onboarding_checklists keeps working exactly as it does today.
--
-- Reuses the existing onboarding.view / onboarding.manage permissions
-- (already granted to operations/ceo/compliance_security in the RBAC
-- foundation migration) rather than adding new ones — this is the same
-- module, just a second, more detailed table within it.

create table if not exists onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,

  client_id uuid references clients(id) on delete set null,
  lead_id uuid references website_leads(id) on delete set null,

  stage text not null default 'new_inquiry',
  priority text not null default 'normal',
  assigned_user_id uuid references staff_profiles(id) on delete set null,
  due_date date,

  notes text,
  blockers text,
  document_references text[] not null default '{}',

  related_contract_id uuid references contracts(id) on delete set null,
  related_proforma_id uuid references proforma_invoices(id) on delete set null,
  related_invoice_id uuid references invoices(id) on delete set null,

  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint onboarding_cases_client_or_lead check (client_id is not null or lead_id is not null)
);

alter table onboarding_cases
  add constraint onboarding_cases_stage_check check (stage in (
    'new_inquiry', 'initial_contact', 'needs_assessment', 'proposal_preparation',
    'proposal_sent', 'negotiation', 'documents_pending', 'documents_received',
    'compliance_review', 'contract_preparation', 'contract_review', 'contract_approval',
    'contract_signature', 'technical_setup', 'integration_testing', 'client_provisioning',
    'training_and_handover', 'activated', 'on_hold', 'rejected'
  ));

alter table onboarding_cases
  add constraint onboarding_cases_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));

create trigger onboarding_cases_set_updated_at
  before update on onboarding_cases
  for each row
  execute function set_updated_at();

alter table onboarding_cases enable row level security;
create policy "onboarding.view can select onboarding_cases" on onboarding_cases for select to authenticated using (has_permission('onboarding.view'));
create policy "onboarding.manage can insert onboarding_cases" on onboarding_cases for insert to authenticated with check (has_permission('onboarding.manage'));
create policy "onboarding.manage can update onboarding_cases" on onboarding_cases for update to authenticated using (has_permission('onboarding.manage')) with check (has_permission('onboarding.manage'));
