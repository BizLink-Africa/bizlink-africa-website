-- Multi-row settings catalogs, same shape/precedent as support_sla_rules:
-- seeded rows, edited in place (status/description/thresholds), no
-- create/delete UI — the catalog itself is the fixed set of categories a
-- module works with, not an open-ended list staff add to freely.

create table if not exists support_ticket_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create trigger support_ticket_categories_set_updated_at before update on support_ticket_categories for each row execute function set_updated_at();
alter table support_ticket_categories enable row level security;
create policy "support.settings.view can select support_ticket_categories" on support_ticket_categories for select to authenticated using (has_permission('support.settings.view'));
create policy "support.settings.manage can update support_ticket_categories" on support_ticket_categories for update to authenticated using (has_permission('support.settings.manage')) with check (has_permission('support.settings.manage'));

insert into support_ticket_categories (name, description) values
  ('Technical', 'Product or platform technical issues'),
  ('Billing', 'Invoicing, payments, and pricing questions'),
  ('Account', 'Login, access, and account management'),
  ('General', 'General inquiries not covered elsewhere'),
  ('Feature Request', 'Suggestions for new functionality'),
  ('Bug Report', 'Defects in existing functionality')
on conflict (name) do nothing;

create table if not exists support_escalation_rules (
  priority text primary key,
  escalate_after_hours numeric(6, 2) not null,
  escalate_to_role text references roles(id) on delete set null,
  updated_at timestamp with time zone not null default now()
);
alter table support_escalation_rules
  add constraint support_escalation_rules_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));
create trigger support_escalation_rules_set_updated_at before update on support_escalation_rules for each row execute function set_updated_at();
alter table support_escalation_rules enable row level security;
create policy "support.settings.view can select support_escalation_rules" on support_escalation_rules for select to authenticated using (has_permission('support.settings.view'));
create policy "support.settings.manage can update support_escalation_rules" on support_escalation_rules for update to authenticated using (has_permission('support.settings.manage')) with check (has_permission('support.settings.manage'));

insert into support_escalation_rules (priority, escalate_after_hours, escalate_to_role) values
  ('low', 72, 'customer_support'),
  ('normal', 48, 'customer_support'),
  ('high', 8, 'ceo'),
  ('urgent', 2, 'ceo')
on conflict (priority) do nothing;

create table if not exists marketing_campaign_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create trigger marketing_campaign_categories_set_updated_at before update on marketing_campaign_categories for each row execute function set_updated_at();
alter table marketing_campaign_categories enable row level security;
create policy "marketing.settings.view can select marketing_campaign_categories" on marketing_campaign_categories for select to authenticated using (has_permission('marketing.settings.view'));
create policy "marketing.settings.manage can update marketing_campaign_categories" on marketing_campaign_categories for update to authenticated using (has_permission('marketing.settings.manage')) with check (has_permission('marketing.settings.manage'));

insert into marketing_campaign_categories (name, description) values
  ('Digital', 'Paid digital advertising'),
  ('Email', 'Email marketing campaigns'),
  ('Social Media', 'Organic and paid social campaigns'),
  ('Referral', 'Client/partner referral programs'),
  ('Partnership', 'Co-marketing with partners'),
  ('Content', 'Content marketing and SEO'),
  ('Events', 'Trade shows, webinars, sponsorships')
on conflict (name) do nothing;

create table if not exists marketing_lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create trigger marketing_lead_sources_set_updated_at before update on marketing_lead_sources for each row execute function set_updated_at();
alter table marketing_lead_sources enable row level security;
create policy "marketing.settings.view can select marketing_lead_sources" on marketing_lead_sources for select to authenticated using (has_permission('marketing.settings.view'));
create policy "marketing.settings.manage can update marketing_lead_sources" on marketing_lead_sources for update to authenticated using (has_permission('marketing.settings.manage')) with check (has_permission('marketing.settings.manage'));

insert into marketing_lead_sources (name) values
  ('Website'), ('Referral'), ('Social Media'), ('Email Campaign'), ('Partner'), ('Cold Outreach'), ('Event'), ('Other')
on conflict (name) do nothing;

create table if not exists technology_deployment_environments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create trigger technology_deployment_environments_set_updated_at before update on technology_deployment_environments for each row execute function set_updated_at();
alter table technology_deployment_environments enable row level security;
create policy "technology.settings.view can select technology_deployment_environments" on technology_deployment_environments for select to authenticated using (has_permission('technology.settings.view'));
create policy "technology.settings.manage can update technology_deployment_environments" on technology_deployment_environments for update to authenticated using (has_permission('technology.settings.manage')) with check (has_permission('technology.settings.manage'));

insert into technology_deployment_environments (name, description) values
  ('Development', 'Local and preview development environments'),
  ('Staging', 'Pre-production verification environment'),
  ('Production', 'Live customer-facing environment')
on conflict (name) do nothing;

create table if not exists compliance_required_documents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create trigger compliance_required_documents_set_updated_at before update on compliance_required_documents for each row execute function set_updated_at();
alter table compliance_required_documents enable row level security;
create policy "compliance.settings.view can select compliance_required_documents" on compliance_required_documents for select to authenticated using (has_permission('compliance.settings.view'));
create policy "compliance.settings.manage can update compliance_required_documents" on compliance_required_documents for update to authenticated using (has_permission('compliance.settings.manage')) with check (has_permission('compliance.settings.manage'));

insert into compliance_required_documents (name, description) values
  ('Business License', 'Valid business registration/license on file'),
  ('Tax Certificate', 'Current tax compliance certificate'),
  ('Data Processing Agreement', 'Signed DPA for client data handling'),
  ('Client Contract', 'Fully executed service contract'),
  ('KYC Documents', 'Know-your-customer verification documents')
on conflict (name) do nothing;
