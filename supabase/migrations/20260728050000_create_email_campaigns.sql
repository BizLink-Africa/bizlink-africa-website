-- Email Campaigns: tracks sends and engagement per email blast. Manual
-- entry — no email-sending platform integration exists in this codebase
-- (Resend here is used only for internal transactional notifications, not
-- marketing sends). Delivery/open/click rates are computed at render time
-- from the raw counts, never stored, so a rate can never disagree with the
-- counts it's derived from.

insert into permissions (id, module, description) values
  ('email_campaigns.view', 'email_campaigns', 'View email campaigns'),
  ('email_campaigns.manage', 'email_campaigns', 'Create/update email campaigns')
on conflict (id) do nothing;

create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  audience_description text,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  sent_date date,
  sent_count int not null default 0,
  delivered_count int not null default 0,
  opened_count int not null default 0,
  clicked_count int not null default 0,
  leads int not null default 0,
  conversions int not null default 0,
  unsubscribes int not null default 0,
  status text not null default 'draft',
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table email_campaigns
  add constraint email_campaigns_status_check check (status in ('draft', 'scheduled', 'sent', 'cancelled'));

create trigger email_campaigns_set_updated_at
  before update on email_campaigns
  for each row
  execute function set_updated_at();

alter table email_campaigns enable row level security;
create policy "email_campaigns.view can select email_campaigns" on email_campaigns for select to authenticated using (has_permission('email_campaigns.view'));
create policy "email_campaigns.manage can insert email_campaigns" on email_campaigns for insert to authenticated with check (has_permission('email_campaigns.manage'));
create policy "email_campaigns.manage can update email_campaigns" on email_campaigns for update to authenticated using (has_permission('email_campaigns.manage')) with check (has_permission('email_campaigns.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'email_campaigns.view'), ('super_admin', 'email_campaigns.manage'),
  ('marketing', 'email_campaigns.view'), ('marketing', 'email_campaigns.manage'),
  ('ceo', 'email_campaigns.view')
on conflict do nothing;
