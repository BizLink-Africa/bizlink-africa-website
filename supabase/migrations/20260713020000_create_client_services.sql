-- Tracks which of BizLink Africa's services are activated for each client.
-- One row per (client, service); service_key is checked against the fixed
-- 10-service catalog in src/data/services.ts — keep both in sync.

create table if not exists client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_key text not null,
  status text not null default 'pending',
  activated_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (client_id, service_key)
);

alter table client_services
  add constraint client_services_service_key_check check (service_key in (
    'ai_sales_agent', 'ai_customer_care_agent', 'social_commerce_automation',
    'ecommerce_store_setup', 'whatsapp_business_api', 'system_api_integration',
    'crm_customer_data_automation', 'business_workflow_automation',
    'ict_consulting', 'payment_integration_support'
  ));
alter table client_services
  add constraint client_services_status_check check (status in (
    'active', 'pending', 'inactive'
  ));

alter table client_services enable row level security;

create policy "Authenticated can view client services"
  on client_services for select to authenticated using (true);
create policy "Authenticated can insert client services"
  on client_services for insert to authenticated with check (true);
create policy "Authenticated can update client services"
  on client_services for update to authenticated using (true) with check (true);

create trigger client_services_set_updated_at
  before update on client_services
  for each row
  execute function set_updated_at();
