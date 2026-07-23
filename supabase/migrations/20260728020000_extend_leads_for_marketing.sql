-- Marketing Leads: adds explicit MQL/SQL qualification flags (manually
-- toggled by marketing/sales, same spirit as the existing manually-
-- progressed CRM stage) and a referral/partnership attribution link,
-- completing the same campaign_id -> website_leads -> clients -> invoices
-- attribution chain already used for marketing_campaigns.

alter table website_leads add column if not exists is_mql boolean not null default false;
alter table website_leads add column if not exists is_sql boolean not null default false;
alter table website_leads add column if not exists referral_partner_id uuid references referral_partnership_campaigns(id) on delete set null;

-- Partnership Campaigns need their own lead_source distinct from the
-- existing 'referral' value, so partnership-attributed leads can be told
-- apart from referral-attributed ones on the Marketing Dashboard.
alter table website_leads drop constraint if exists website_leads_lead_source_check;
alter table website_leads
  add constraint website_leads_lead_source_check check (lead_source is null or lead_source in (
    'website', 'referral', 'social_media', 'campaign', 'partnership', 'cold_call', 'walk_in', 'other'
  ));

-- website_leads has never had an authenticated-role INSERT policy (only
-- the public "anon" form-submission policy from the original schema) —
-- admin-side lead creation (the CRM's existing createLead action, and the
-- new createMarketingLead below) needs one. Gated by the leads.create
-- permission that already exists in the catalog, matching how every other
-- table's insert policy is named after its create permission.
create policy "leads.create can insert website_leads"
  on website_leads for insert to authenticated with check (has_permission('leads.create'));

-- marketing_leads.view gates the new Marketing Leads page itself; the
-- actual reads/writes underneath still go through website_leads' own
-- leads.create/leads.update-backed RLS (this is the same table the CRM
-- Leads page already uses, just a marketing-focused view of it).
insert into permissions (id, module, description) values
  ('marketing_leads.view', 'marketing_leads', 'View the Marketing Leads page')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'marketing_leads.view'),
  ('marketing', 'marketing_leads.view'), ('marketing', 'leads.create'), ('marketing', 'leads.update'),
  ('ceo', 'marketing_leads.view')
on conflict do nothing;
