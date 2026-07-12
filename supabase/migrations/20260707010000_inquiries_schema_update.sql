-- Expands website_leads from the original 3-boolean contact form into the
-- full inquiry model (multi-select needs, admin workflow, email notification
-- tracking) used by the Super Admin dashboard and the Resend email flow.

alter table website_leads rename column phone_whatsapp to phone;
alter table website_leads rename column business_category to business_type;
alter table website_leads rename column physical_location to location;
alter table website_leads rename column additional_notes to message;

alter table website_leads
  add column if not exists requested_solution text[] not null default '{}',
  add column if not exists preferred_contact_method text,
  add column if not exists admin_notes text,
  add column if not exists notification_status text not null default 'pending',
  add column if not exists consent_given boolean not null default false,
  add column if not exists updated_at timestamp with time zone not null default now();

-- Backfill requested_solution from the old boolean flags for existing rows,
-- then retire those columns now that a single array field replaces them.
update website_leads set requested_solution = array_remove(array[
  case when needs_social_commerce_api then 'social_commerce_platform' end,
  case when needs_ai_automation then 'ai_sales_agent' end,
  case when needs_payment_integration_support then 'payment_integration_support' end
], null)
where requested_solution = '{}';

alter table website_leads
  drop column if exists needs_social_commerce_api,
  drop column if exists needs_ai_automation,
  drop column if exists needs_payment_integration_support;

alter table website_leads
  drop constraint if exists website_leads_status_check;
alter table website_leads
  add constraint website_leads_status_check check (status in (
    'new', 'contacted', 'in_discussion', 'documents_requested',
    'proposal_sent', 'onboarding', 'completed', 'rejected'
  ));

alter table website_leads
  drop constraint if exists website_leads_notification_status_check;
alter table website_leads
  add constraint website_leads_notification_status_check check (notification_status in (
    'pending', 'sent', 'failed'
  ));

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists website_leads_set_updated_at on website_leads;
create trigger website_leads_set_updated_at
  before update on website_leads
  for each row
  execute function set_updated_at();

-- Admin dashboard access: signed-in Supabase Auth users (the manually
-- created admin accounts) may view and update inquiries. There is no public
-- sign-up flow, so "authenticated" here effectively means "trusted admin".
drop policy if exists "Authenticated can view leads" on website_leads;
create policy "Authenticated can view leads"
  on website_leads
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can update leads" on website_leads;
create policy "Authenticated can update leads"
  on website_leads
  for update
  to authenticated
  using (true)
  with check (true);
