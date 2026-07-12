-- Closes the RBAC gap flagged in the pre-launch audit: every table previously
-- granted full read/write to "any authenticated Supabase user" with no check
-- that the user is an actual staff member. That meant any Supabase Auth
-- account for this project — not just ones you created for your team — would
-- get full admin access, and any logged-in user could promote themselves to
-- super_admin via Staff & Roles.
--
-- This migration:
--   1. Adds is_active_staff(), a security-definer helper checking the caller
--      has an active row in staff_profiles.
--   2. Replaces every blanket "to authenticated using (true)" policy with
--      "using (is_active_staff())".
--   3. Leaves staff_profiles UPDATE open to any active staff member at the
--      RLS layer (RLS can't cheaply distinguish "changing my own role" from
--      "changing my department"), but the app layer (updateStaffRole in
--      src/app/admin/(protected)/staff/actions.ts) now requires the caller
--      be super_admin before calling this at all — so role escalation is
--      blocked at the point that matters.
--
-- IMPORTANT: before running this, confirm every real admin/staff user has an
-- active row in staff_profiles with user_id set to their auth.users id — see
-- the app's own onboarding flow (Staff & Roles page) or insert directly.
-- Anyone without such a row loses all admin access the moment this runs.

create or replace function is_active_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from staff_profiles
    where user_id = auth.uid() and is_active = true
  );
$$;

create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from staff_profiles
    where user_id = auth.uid() and is_active = true and role = 'super_admin'
  );
$$;

-- website_leads
drop policy if exists "Authenticated can view leads" on website_leads;
create policy "Active staff can view leads"
  on website_leads for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can update leads" on website_leads;
create policy "Active staff can update leads"
  on website_leads for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- clients
drop policy if exists "Authenticated can view clients" on clients;
create policy "Active staff can view clients"
  on clients for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert clients" on clients;
create policy "Active staff can insert clients"
  on clients for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update clients" on clients;
create policy "Active staff can update clients"
  on clients for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- client_services
drop policy if exists "Authenticated can view client services" on client_services;
create policy "Active staff can view client services"
  on client_services for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert client services" on client_services;
create policy "Active staff can insert client services"
  on client_services for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update client services" on client_services;
create policy "Active staff can update client services"
  on client_services for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- onboarding_checklists
drop policy if exists "Authenticated can view onboarding checklists" on onboarding_checklists;
create policy "Active staff can view onboarding checklists"
  on onboarding_checklists for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert onboarding checklists" on onboarding_checklists;
create policy "Active staff can insert onboarding checklists"
  on onboarding_checklists for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update onboarding checklists" on onboarding_checklists;
create policy "Active staff can update onboarding checklists"
  on onboarding_checklists for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- staff_profiles: view/insert require active staff; UPDATE guarded at the app
-- layer (see comment above) rather than here, since every active staff member
-- legitimately needs to update non-role fields (e.g. their own record).
drop policy if exists "Authenticated can view staff profiles" on staff_profiles;
create policy "Active staff can view staff profiles"
  on staff_profiles for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert staff profiles" on staff_profiles;
create policy "Active staff can insert staff profiles"
  on staff_profiles for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update staff profiles" on staff_profiles;
create policy "Active staff can update staff profiles"
  on staff_profiles for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- support_tickets
drop policy if exists "Authenticated can view support tickets" on support_tickets;
create policy "Active staff can view support tickets"
  on support_tickets for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert support tickets" on support_tickets;
create policy "Active staff can insert support tickets"
  on support_tickets for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update support tickets" on support_tickets;
create policy "Active staff can update support tickets"
  on support_tickets for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- support_ticket_messages
drop policy if exists "Authenticated can view ticket messages" on support_ticket_messages;
create policy "Active staff can view ticket messages"
  on support_ticket_messages for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert ticket messages" on support_ticket_messages;
create policy "Active staff can insert ticket messages"
  on support_ticket_messages for insert to authenticated with check (is_active_staff());

-- integration_health
drop policy if exists "Authenticated can view integration health" on integration_health;
create policy "Active staff can view integration health"
  on integration_health for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert integration health" on integration_health;
create policy "Active staff can insert integration health"
  on integration_health for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update integration health" on integration_health;
create policy "Active staff can update integration health"
  on integration_health for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- ai_agent_configs
drop policy if exists "Authenticated can view ai agent configs" on ai_agent_configs;
create policy "Active staff can view ai agent configs"
  on ai_agent_configs for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert ai agent configs" on ai_agent_configs;
create policy "Active staff can insert ai agent configs"
  on ai_agent_configs for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update ai agent configs" on ai_agent_configs;
create policy "Active staff can update ai agent configs"
  on ai_agent_configs for update to authenticated using (is_active_staff()) with check (is_active_staff());

-- audit_logs (still append-only — no update/delete policy)
drop policy if exists "Authenticated can view audit logs" on audit_logs;
create policy "Active staff can view audit logs"
  on audit_logs for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert audit logs" on audit_logs;
create policy "Active staff can insert audit logs"
  on audit_logs for insert to authenticated with check (is_active_staff());

-- company_settings
drop policy if exists "Authenticated can view company settings" on company_settings;
create policy "Active staff can view company settings"
  on company_settings for select to authenticated using (is_active_staff());
drop policy if exists "Authenticated can insert company settings" on company_settings;
create policy "Active staff can insert company settings"
  on company_settings for insert to authenticated with check (is_active_staff());
drop policy if exists "Authenticated can update company settings" on company_settings;
create policy "Active staff can update company settings"
  on company_settings for update to authenticated using (is_active_staff()) with check (is_active_staff());
