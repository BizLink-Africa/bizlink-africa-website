-- Adds follow-up tracking fields to website_leads for the Super Admin
-- Leads/Inquiries dashboard: priority, assignment, and manual follow-up
-- scheduling. Additive only — existing rows/columns are untouched, and
-- every new column is nullable or has a safe default so no data is lost
-- or broken.

alter table website_leads
  add column if not exists follow_up_date date,
  add column if not exists last_contacted_at timestamp with time zone,
  add column if not exists assigned_to text,
  add column if not exists priority text not null default 'normal';

alter table website_leads
  drop constraint if exists website_leads_priority_check;
alter table website_leads
  add constraint website_leads_priority_check check (priority in (
    'low', 'normal', 'high', 'urgent'
  ));
