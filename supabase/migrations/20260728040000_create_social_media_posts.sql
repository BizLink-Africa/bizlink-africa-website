-- Social Media: a log of individual posts and their performance. Manual
-- entry (reach/engagement/clicks) — this codebase has no social platform
-- API integrations, so there's no live data source to pull these from.

insert into permissions (id, module, description) values
  ('social_media.view', 'social_media', 'View social media posts'),
  ('social_media.manage', 'social_media', 'Log/update social media posts')
on conflict (id) do nothing;

create table if not exists social_media_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  post_reference text,
  posted_date date,
  reach int not null default 0,
  engagement int not null default 0,
  clicks int not null default 0,
  leads int not null default 0,
  conversions int not null default 0,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table social_media_posts
  add constraint social_media_posts_platform_check check (platform in (
    'facebook', 'instagram', 'whatsapp', 'tiktok', 'linkedin', 'x', 'other'
  ));

create trigger social_media_posts_set_updated_at
  before update on social_media_posts
  for each row
  execute function set_updated_at();

alter table social_media_posts enable row level security;
create policy "social_media.view can select social_media_posts" on social_media_posts for select to authenticated using (has_permission('social_media.view'));
create policy "social_media.manage can insert social_media_posts" on social_media_posts for insert to authenticated with check (has_permission('social_media.manage'));
create policy "social_media.manage can update social_media_posts" on social_media_posts for update to authenticated using (has_permission('social_media.manage')) with check (has_permission('social_media.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'social_media.view'), ('super_admin', 'social_media.manage'),
  ('marketing', 'social_media.view'), ('marketing', 'social_media.manage'),
  ('ceo', 'social_media.view')
on conflict do nothing;
