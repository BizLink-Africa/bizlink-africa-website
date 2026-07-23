-- Real in-app notification center. admin_notifications is the message
-- itself (optionally targeted at one department, or null = every active
-- staff member); read state is PER-VIEWER, so it lives in a separate join
-- table — exact same shape as governance_policies + policy_acknowledgements
-- (one row per document/notification, one row per (document, staff) who's
-- acted on it). This is the only correct way to support "read/unread" on a
-- notification that can be visible to many staff at once.

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  priority text not null default 'normal',
  department text,
  related_module text,
  related_record_id text,
  created_by text not null,
  created_at timestamp with time zone not null default now()
);

alter table admin_notifications
  add constraint admin_notifications_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));
alter table admin_notifications
  add constraint admin_notifications_department_check check (department is null or department in (
    'Executive', 'Finance', 'Technology', 'Operations', 'Marketing',
    'Customer Support', 'Compliance & Security', 'Administration'
  ));

create table if not exists admin_notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references admin_notifications(id) on delete cascade,
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  read_at timestamp with time zone not null default now(),
  unique (notification_id, staff_id)
);

alter table admin_notifications enable row level security;
-- Visible to any active staff member (notifications.view is granted to
-- every role in the seed migration) — filtering to "department is null OR
-- department = viewer's department" happens in the query, not RLS, since
-- has_permission() has no way to compare against the caller's own
-- staff_profiles.department without a second join every policy would repeat.
create policy "notifications.view can select admin_notifications" on admin_notifications for select to authenticated using (has_permission('notifications.view'));
create policy "notifications.manage can insert admin_notifications" on admin_notifications for insert to authenticated with check (has_permission('notifications.manage'));

alter table admin_notification_reads enable row level security;
create policy "notifications.view can select own admin_notification_reads" on admin_notification_reads for select to authenticated using (
  has_permission('notifications.view') and staff_id in (select id from staff_profiles where user_id = auth.uid())
);
create policy "staff can mark their own notifications read" on admin_notification_reads for insert to authenticated with check (
  has_permission('notifications.view') and staff_id in (select id from staff_profiles where user_id = auth.uid())
);
