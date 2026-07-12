create table if not exists website_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  business_name text not null,
  business_category text not null,
  physical_location text not null,
  phone_whatsapp text not null,
  email text not null,
  needs_social_commerce_api boolean default false,
  needs_ai_automation boolean default false,
  needs_payment_integration_support boolean default false,
  additional_notes text,
  status text default 'new',
  created_at timestamp with time zone default now()
);

alter table website_leads enable row level security;

-- Public website form may only insert leads. It must never be able to
-- read, update, or delete leads — that stays reserved for the service
-- role key used by the future Super Admin Dashboard.
create policy "Public can submit leads"
  on website_leads
  for insert
  to anon
  with check (true);
