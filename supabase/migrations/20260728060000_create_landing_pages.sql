-- Landing Pages: tracks visits/submissions per marketing landing page.
-- Conversion rate (form_submissions / visits) is computed at render time,
-- not stored.

insert into permissions (id, module, description) values
  ('landing_pages.view', 'landing_pages', 'View landing pages'),
  ('landing_pages.manage', 'landing_pages', 'Create/update landing pages')
on conflict (id) do nothing;

create table if not exists landing_pages (
  id uuid primary key default gen_random_uuid(),
  page_name text not null,
  url_reference text,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  visits int not null default 0,
  form_submissions int not null default 0,
  status text not null default 'draft',
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table landing_pages
  add constraint landing_pages_status_check check (status in ('draft', 'live', 'archived'));

create trigger landing_pages_set_updated_at
  before update on landing_pages
  for each row
  execute function set_updated_at();

alter table landing_pages enable row level security;
create policy "landing_pages.view can select landing_pages" on landing_pages for select to authenticated using (has_permission('landing_pages.view'));
create policy "landing_pages.manage can insert landing_pages" on landing_pages for insert to authenticated with check (has_permission('landing_pages.manage'));
create policy "landing_pages.manage can update landing_pages" on landing_pages for update to authenticated using (has_permission('landing_pages.manage')) with check (has_permission('landing_pages.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'landing_pages.view'), ('super_admin', 'landing_pages.manage'),
  ('marketing', 'landing_pages.view'), ('marketing', 'landing_pages.manage'),
  ('ceo', 'landing_pages.view')
on conflict do nothing;
