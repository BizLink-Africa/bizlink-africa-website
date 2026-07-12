-- Offline onboarding checklist. One row per lead and/or per client —
-- lead_id is set for checklists started before conversion (lazily created
-- the first time the widget is opened on a lead), client_id is set once a
-- client record exists (either filled in at conversion so the same
-- checklist carries through, or set alone for clients added manually with
-- no originating lead). At least one of the two must be present.

create table if not exists onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid unique references website_leads(id) on delete cascade,
  client_id uuid unique references clients(id) on delete cascade,
  initial_consultation_done boolean not null default false,
  business_details_confirmed boolean not null default false,
  proposal_sent boolean not null default false,
  contract_signed boolean not null default false,
  technical_requirements_collected boolean not null default false,
  payment_partner_onboarding_started boolean not null default false,
  system_setup_started boolean not null default false,
  testing_completed boolean not null default false,
  client_training_completed boolean not null default false,
  go_live_approved boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint onboarding_checklists_owner_check check (lead_id is not null or client_id is not null)
);

alter table onboarding_checklists enable row level security;

create policy "Authenticated can view onboarding checklists"
  on onboarding_checklists for select to authenticated using (true);
create policy "Authenticated can insert onboarding checklists"
  on onboarding_checklists for insert to authenticated with check (true);
create policy "Authenticated can update onboarding checklists"
  on onboarding_checklists for update to authenticated using (true) with check (true);

create trigger onboarding_checklists_set_updated_at
  before update on onboarding_checklists
  for each row
  execute function set_updated_at();
