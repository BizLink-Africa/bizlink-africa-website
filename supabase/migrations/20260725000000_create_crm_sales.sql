-- CRM & Sales: extends leads/clients with real CRM fields, replaces
-- free-text staff assignment with foreign keys (safe — old text columns are
-- kept, not dropped), and adds five new entities (client_contacts,
-- opportunities, proposals, proposal_versions, crm_follow_ups) following
-- this schema's established conventions: text + CHECK constraint status
-- columns, set_updated_at() triggers, RLS via has_permission(), atomic
-- numbering via the existing prefix-agnostic next_finance_number RPC.

-- ============================================================
-- 1. website_leads: new CRM columns (additive — status/assigned_to unchanged)
-- ============================================================

alter table website_leads add column if not exists lead_number text unique;
alter table website_leads add column if not exists stage text not null default 'new';
alter table website_leads add column if not exists lead_score int not null default 0;
alter table website_leads add column if not exists lead_source text;
alter table website_leads add column if not exists assigned_user_id uuid references staff_profiles(id) on delete set null;
alter table website_leads add column if not exists campaign_id uuid references marketing_campaigns(id) on delete set null;

alter table website_leads
  add constraint website_leads_stage_check check (stage in (
    'new', 'contacted', 'qualified', 'needs_assessment', 'proposal_preparation',
    'proposal_sent', 'negotiation', 'won', 'lost', 'on_hold'
  ));

alter table website_leads
  add constraint website_leads_lead_score_check check (lead_score >= 0 and lead_score <= 100);

alter table website_leads
  add constraint website_leads_lead_source_check check (lead_source is null or lead_source in (
    'website', 'referral', 'social_media', 'campaign', 'cold_call', 'walk_in', 'other'
  ));

-- Backfills lead_number for existing rows (new rows get one at insert time
-- from application code, same as contracts/invoices/proformas already do).
do $$
declare
  lead record;
begin
  for lead in select id from website_leads where lead_number is null order by created_at loop
    update website_leads set lead_number = next_finance_number('LED') where id = lead.id;
  end loop;
end $$;

-- ============================================================
-- 2. clients: new CRM columns (additive — assigned_staff unchanged)
-- ============================================================

alter table clients add column if not exists client_number text unique;
alter table clients add column if not exists industry text;
alter table clients add column if not exists account_owner_id uuid references staff_profiles(id) on delete set null;

do $$
declare
  c record;
begin
  for c in select id from clients where client_number is null order by created_at loop
    update clients set client_number = next_finance_number('CLI') where id = c.id;
  end loop;
end $$;

-- ============================================================
-- 3. Backfill assigned_user_id / account_owner_id — unambiguous exact
--    matches only. No unique constraint exists on staff_profiles.full_name,
--    so the inner count subquery guarantees a name shared by two or more
--    staff is left null rather than guessed.
-- ============================================================

update website_leads wl
set assigned_user_id = sp.id
from staff_profiles sp
where wl.assigned_user_id is null
  and wl.assigned_to is not null
  and lower(trim(wl.assigned_to)) = lower(trim(sp.full_name))
  and (
    select count(*) from staff_profiles sp2
    where lower(trim(sp2.full_name)) = lower(trim(sp.full_name))
  ) = 1;

update clients c
set account_owner_id = sp.id
from staff_profiles sp
where c.account_owner_id is null
  and c.assigned_staff is not null
  and lower(trim(c.assigned_staff)) = lower(trim(sp.full_name))
  and (
    select count(*) from staff_profiles sp2
    where lower(trim(sp2.full_name)) = lower(trim(sp.full_name))
  ) = 1;

-- ============================================================
-- 4. client_contacts
-- ============================================================

create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  full_name text not null,
  role_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create trigger client_contacts_set_updated_at
  before update on client_contacts
  for each row
  execute function set_updated_at();

alter table client_contacts enable row level security;
create policy "clients.view can select client_contacts" on client_contacts for select to authenticated using (has_permission('clients.view'));
create policy "clients.update can insert client_contacts" on client_contacts for insert to authenticated with check (has_permission('clients.update'));
create policy "clients.update can update client_contacts" on client_contacts for update to authenticated using (has_permission('clients.update')) with check (has_permission('clients.update'));
create policy "clients.update can delete client_contacts" on client_contacts for delete to authenticated using (has_permission('clients.update'));

-- ============================================================
-- 5. opportunities
-- ============================================================

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_number text not null unique,
  name text not null,
  client_id uuid references clients(id) on delete set null,
  lead_id uuid references website_leads(id) on delete set null,
  related_service text,
  estimated_value numeric(14,2) not null default 0,
  currency text not null default 'TZS',
  probability int not null default 0,
  stage text not null default 'identified',
  expected_close_date date,
  owner_user_id uuid references staff_profiles(id) on delete set null,
  competitor_notes text,
  next_action text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint opportunities_client_or_lead check (client_id is not null or lead_id is not null)
);

alter table opportunities
  add constraint opportunities_probability_check check (probability >= 0 and probability <= 100);

alter table opportunities
  add constraint opportunities_stage_check check (stage in (
    'identified', 'qualified', 'solution_proposed', 'proposal_sent', 'negotiation',
    'verbal_agreement', 'won', 'lost', 'on_hold'
  ));

create trigger opportunities_set_updated_at
  before update on opportunities
  for each row
  execute function set_updated_at();

alter table opportunities enable row level security;
create policy "opportunities.view can select opportunities" on opportunities for select to authenticated using (has_permission('opportunities.view'));
create policy "opportunities.manage can insert opportunities" on opportunities for insert to authenticated with check (has_permission('opportunities.manage'));
create policy "opportunities.manage can update opportunities" on opportunities for update to authenticated using (has_permission('opportunities.manage')) with check (has_permission('opportunities.manage'));

-- ============================================================
-- 6. proposals + proposal_versions
-- ============================================================

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_number text not null unique,
  lead_id uuid references website_leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  services text[] not null default '{}',
  scope text,
  pricing_summary_total numeric(14,2) not null default 0,
  currency text not null default 'TZS',
  pricing_notes text,
  valid_until date,
  status text not null default 'draft',
  created_by text,
  approved_by text,
  sent_date date,
  client_response text,
  related_proforma_id uuid references proforma_invoices(id) on delete set null,
  related_contract_id uuid references contracts(id) on delete set null,
  current_version int not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint proposals_lead_or_client check (lead_id is not null or client_id is not null)
);

alter table proposals
  add constraint proposals_status_check check (status in (
    'draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'converted'
  ));

create trigger proposals_set_updated_at
  before update on proposals
  for each row
  execute function set_updated_at();

alter table proposals enable row level security;
create policy "proposals.view can select proposals" on proposals for select to authenticated using (has_permission('proposals.view'));
create policy "proposals.manage can insert proposals" on proposals for insert to authenticated with check (has_permission('proposals.manage'));
create policy "proposals.manage can update proposals" on proposals for update to authenticated using (has_permission('proposals.manage')) with check (has_permission('proposals.manage'));

create table if not exists proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  version_number int not null,
  file_path text not null,
  file_name text not null,
  uploaded_by text,
  created_at timestamp with time zone not null default now()
);

alter table proposal_versions enable row level security;
create policy "proposals.view can select proposal_versions" on proposal_versions for select to authenticated using (has_permission('proposals.view'));
create policy "proposals.manage can insert proposal_versions" on proposal_versions for insert to authenticated with check (has_permission('proposals.manage'));

insert into storage.buckets (id, name, public)
values ('proposal-files', 'proposal-files', false)
on conflict (id) do nothing;

create policy "proposals.manage can upload proposal files" on storage.objects
  for insert to authenticated with check (bucket_id = 'proposal-files' and has_permission('proposals.manage'));
create policy "proposals.view can read proposal files" on storage.objects
  for select to authenticated using (bucket_id = 'proposal-files' and has_permission('proposals.view'));

-- ============================================================
-- 7. crm_follow_ups
-- ============================================================

create table if not exists crm_follow_ups (
  id uuid primary key default gen_random_uuid(),
  follow_up_date date not null,
  lead_id uuid references website_leads(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  assigned_user_id uuid references staff_profiles(id) on delete set null,
  communication_type text not null default 'call',
  purpose text,
  result text,
  next_action text,
  status text not null default 'scheduled',
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint crm_follow_ups_lead_or_client check (lead_id is not null or client_id is not null)
);

alter table crm_follow_ups
  add constraint crm_follow_ups_communication_type_check check (communication_type in (
    'call', 'email', 'whatsapp', 'meeting', 'other'
  ));

alter table crm_follow_ups
  add constraint crm_follow_ups_status_check check (status in ('scheduled', 'completed', 'cancelled'));

create trigger crm_follow_ups_set_updated_at
  before update on crm_follow_ups
  for each row
  execute function set_updated_at();

alter table crm_follow_ups enable row level security;
create policy "crm.followups.view can select crm_follow_ups" on crm_follow_ups for select to authenticated using (has_permission('crm.followups.view'));
create policy "crm.followups.manage can insert crm_follow_ups" on crm_follow_ups for insert to authenticated with check (has_permission('crm.followups.manage'));
create policy "crm.followups.manage can update crm_follow_ups" on crm_follow_ups for update to authenticated using (has_permission('crm.followups.manage')) with check (has_permission('crm.followups.manage'));

-- ============================================================
-- 8. Permissions
-- ============================================================

insert into permissions (id, module, description) values
  ('dashboard.crm.view', 'dashboard', 'View CRM Dashboard'),
  ('leads.convert', 'leads', 'Convert a lead to a client'),
  ('opportunities.view', 'opportunities', 'View opportunities'),
  ('opportunities.manage', 'opportunities', 'Create/update opportunities'),
  ('proposals.view', 'proposals', 'View proposals'),
  ('proposals.manage', 'proposals', 'Create/update proposals'),
  ('crm.followups.view', 'crm', 'View CRM follow-ups'),
  ('crm.followups.manage', 'crm', 'Create/update CRM follow-ups'),
  ('crm.reports.view', 'crm', 'View CRM reports'),
  ('crm.reports.export', 'crm', 'Export CRM reports')
on conflict (id) do nothing;

-- New permissions always need an explicit super_admin grant — the
-- "super_admin gets every existing permission" bulk insert in the RBAC
-- foundation migration already ran once (same idiom as the governance_module
-- and executive_management migrations).
insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'dashboard.crm.view'), ('super_admin', 'leads.convert'),
  ('super_admin', 'opportunities.view'), ('super_admin', 'opportunities.manage'),
  ('super_admin', 'proposals.view'), ('super_admin', 'proposals.manage'),
  ('super_admin', 'crm.followups.view'), ('super_admin', 'crm.followups.manage'),
  ('super_admin', 'crm.reports.view'), ('super_admin', 'crm.reports.export'),
  ('ceo', 'dashboard.crm.view'), ('ceo', 'opportunities.view'), ('ceo', 'proposals.view'),
  ('ceo', 'crm.followups.view'), ('ceo', 'crm.reports.view'), ('ceo', 'crm.reports.export'),
  ('marketing', 'dashboard.crm.view'), ('marketing', 'leads.convert'),
  ('marketing', 'opportunities.view'), ('marketing', 'opportunities.manage'),
  ('marketing', 'proposals.view'), ('marketing', 'proposals.manage'),
  ('marketing', 'crm.followups.view'), ('marketing', 'crm.followups.manage'),
  ('operations', 'leads.convert')
on conflict do nothing;
