-- Adds rollout/delivery workflow tracking to client_services, separate from
-- the coarse active/pending/inactive `status` field (which just says
-- whether a service is currently switched on) and separate from the
-- generic onboarding_checklists milestones. This is Operations' queue for
-- "where is this specific service in its delivery process."

alter table client_services add column if not exists delivery_status text not null default 'not_started';
alter table client_services add column if not exists scheduled_date date;
alter table client_services add column if not exists delivery_started_at timestamp with time zone;
alter table client_services add column if not exists delivered_at timestamp with time zone;
alter table client_services add column if not exists assigned_to text;
alter table client_services add column if not exists delivery_notes text;

alter table client_services
  add constraint client_services_delivery_status_check check (delivery_status in (
    'not_started', 'scheduled', 'in_progress', 'delivered', 'on_hold', 'cancelled'
  ));

-- Tighten RLS to match the RBAC model used by every module built since
-- (contracts, finance): this table previously allowed any authenticated
-- staff member to read/write it regardless of role. Verified no currently
-- granted role depends on the old open policy — only 'operations' (and
-- super_admin, which has everything) holds clients.update today, and it
-- already holds services.manage too.
drop policy if exists "Authenticated can view client services" on client_services;
drop policy if exists "Authenticated can insert client services" on client_services;
drop policy if exists "Authenticated can update client services" on client_services;

create policy "View client services with permission"
  on client_services for select to authenticated
  using (has_permission('services.view'));
create policy "Insert client services with permission"
  on client_services for insert to authenticated
  with check (has_permission('services.manage'));
create policy "Update client services with permission"
  on client_services for update to authenticated
  using (has_permission('services.manage'))
  with check (has_permission('services.manage'));
