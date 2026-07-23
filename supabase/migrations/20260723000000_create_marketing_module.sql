-- Marketing module: campaigns run by BizLink Africa itself (lead generation /
-- growth), not a service delivered to clients. Fills a permission set that
-- was seeded in the RBAC migration (campaigns.*, dashboard.marketing.view)
-- but had no table or page using it yet.

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  objective text,
  status text not null default 'draft',
  start_date date,
  end_date date,
  budget numeric(14,2) not null default 0,
  currency text not null default 'TZS',
  target_audience text,
  description text,
  leads_generated int not null default 0,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table marketing_campaigns
  add constraint marketing_campaigns_channel_check check (channel in (
    'facebook', 'instagram', 'whatsapp', 'email', 'sms', 'google', 'other'
  ));

alter table marketing_campaigns
  add constraint marketing_campaigns_status_check check (status in (
    'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'
  ));

create trigger marketing_campaigns_set_updated_at
  before update on marketing_campaigns
  for each row
  execute function set_updated_at();

-- ============================================================
-- Permissions: campaigns.view/campaigns.manage/dashboard.marketing.view
-- already exist in the catalog (seeded dormant) — grant them to the
-- marketing role (which previously only had leads.view/clients.view) and
-- give ceo view-only visibility, matching the broad-visibility pattern used
-- for finance.
-- ============================================================

insert into role_permissions (role_id, permission_id) values
  ('marketing', 'campaigns.view'), ('marketing', 'campaigns.manage'), ('marketing', 'dashboard.marketing.view'),
  ('ceo', 'campaigns.view'), ('ceo', 'dashboard.marketing.view')
on conflict do nothing;

-- ============================================================
-- RLS
-- ============================================================

alter table marketing_campaigns enable row level security;
create policy "campaigns.view can select campaigns" on marketing_campaigns for select to authenticated using (has_permission('campaigns.view'));
create policy "campaigns.manage can insert campaigns" on marketing_campaigns for insert to authenticated with check (has_permission('campaigns.manage'));
create policy "campaigns.manage can update campaigns" on marketing_campaigns for update to authenticated using (has_permission('campaigns.manage')) with check (has_permission('campaigns.manage'));
