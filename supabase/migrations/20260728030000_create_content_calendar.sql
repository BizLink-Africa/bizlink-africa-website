-- Content Calendar: planned/published marketing content, optionally tied
-- to a campaign. Separate approval_status from status — a piece of
-- content can be "in progress" and "pending approval" at once; collapsing
-- them into one field would lose that.

insert into permissions (id, module, description) values
  ('content_calendar.view', 'content_calendar', 'View the content calendar'),
  ('content_calendar.manage', 'content_calendar', 'Create/update content calendar items')
on conflict (id) do nothing;

create table if not exists content_calendar_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  content_type text not null default 'post',
  planned_date date,
  owner_user_id uuid references staff_profiles(id) on delete set null,
  status text not null default 'planned',
  approval_status text not null default 'pending',
  published_link text,
  performance_notes text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table content_calendar_items
  add constraint content_calendar_items_content_type_check check (content_type in (
    'post', 'article', 'video', 'email', 'ad', 'other'
  ));
alter table content_calendar_items
  add constraint content_calendar_items_status_check check (status in (
    'planned', 'in_progress', 'ready', 'published', 'cancelled'
  ));
alter table content_calendar_items
  add constraint content_calendar_items_approval_status_check check (approval_status in (
    'pending', 'approved', 'rejected'
  ));

create trigger content_calendar_items_set_updated_at
  before update on content_calendar_items
  for each row
  execute function set_updated_at();

alter table content_calendar_items enable row level security;
create policy "content_calendar.view can select content_calendar_items" on content_calendar_items for select to authenticated using (has_permission('content_calendar.view'));
create policy "content_calendar.manage can insert content_calendar_items" on content_calendar_items for insert to authenticated with check (has_permission('content_calendar.manage'));
create policy "content_calendar.manage can update content_calendar_items" on content_calendar_items for update to authenticated using (has_permission('content_calendar.manage')) with check (has_permission('content_calendar.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'content_calendar.view'), ('super_admin', 'content_calendar.manage'),
  ('marketing', 'content_calendar.view'), ('marketing', 'content_calendar.manage'),
  ('ceo', 'content_calendar.view')
on conflict do nothing;
