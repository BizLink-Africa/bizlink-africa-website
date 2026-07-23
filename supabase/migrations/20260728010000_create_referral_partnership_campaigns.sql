-- Referral Campaigns and Partnership Campaigns share one table (type
-- distinguishes them) since they're the same shape: someone outside
-- BizLink Africa (a referrer or a partner org) sending leads BizLink's way.
-- Attribution (leads/conversions/revenue) is computed live via the
-- referral_partner_id FK added to website_leads in the next migration —
-- not stored here, so it can never drift from what actually happened.

insert into permissions (id, module, description) values
  ('referrals.view', 'referrals', 'View referral and partnership campaigns'),
  ('referrals.manage', 'referrals', 'Create/update referral and partnership campaigns')
on conflict (id) do nothing;

create table if not exists referral_partnership_campaigns (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  referrer_or_partner_name text not null,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  status text not null default 'active',
  notes text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table referral_partnership_campaigns
  add constraint referral_partnership_campaigns_type_check check (type in ('referral', 'partnership'));
alter table referral_partnership_campaigns
  add constraint referral_partnership_campaigns_status_check check (status in ('active', 'completed', 'paused'));

create trigger referral_partnership_campaigns_set_updated_at
  before update on referral_partnership_campaigns
  for each row
  execute function set_updated_at();

alter table referral_partnership_campaigns enable row level security;
create policy "referrals.view can select referral_partnership_campaigns" on referral_partnership_campaigns for select to authenticated using (has_permission('referrals.view'));
create policy "referrals.manage can insert referral_partnership_campaigns" on referral_partnership_campaigns for insert to authenticated with check (has_permission('referrals.manage'));
create policy "referrals.manage can update referral_partnership_campaigns" on referral_partnership_campaigns for update to authenticated using (has_permission('referrals.manage')) with check (has_permission('referrals.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'referrals.view'), ('super_admin', 'referrals.manage'),
  ('marketing', 'referrals.view'), ('marketing', 'referrals.manage'),
  ('ceo', 'referrals.view')
on conflict do nothing;
