-- Clients: the record a lead becomes once BizLink Africa is actively working
-- with them (via "Convert lead to client" in the Super Admin dashboard, or
-- entered directly for clients that predate this system).

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references website_leads(id) on delete set null,
  client_name text not null,
  business_name text not null,
  business_type text,
  contact_person text,
  email text not null,
  phone text not null,
  location text,
  onboarding_status text not null default 'not_started',
  integration_status text not null default 'not_started',
  assigned_staff text,
  is_active boolean not null default true,
  internal_notes text,
  date_joined date not null default current_date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table clients
  add constraint clients_onboarding_status_check check (onboarding_status in (
    'not_started', 'in_progress', 'completed'
  ));
alter table clients
  add constraint clients_integration_status_check check (integration_status in (
    'not_started', 'in_progress', 'active', 'issue'
  ));

alter table clients enable row level security;

-- Same trust model as website_leads: any signed-in Supabase Auth user is an
-- admin (single-admin-account setup today, no roles table enforcing this
-- yet — see staff_profiles / Phase 2 for the planned role model).
create policy "Authenticated can view clients"
  on clients for select to authenticated using (true);
create policy "Authenticated can insert clients"
  on clients for insert to authenticated with check (true);
create policy "Authenticated can update clients"
  on clients for update to authenticated using (true) with check (true);

create trigger clients_set_updated_at
  before update on clients
  for each row
  execute function set_updated_at();
