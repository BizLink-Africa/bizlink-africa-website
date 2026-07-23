-- Compliance & Security module build-out (Compliance/Security Dashboards,
-- Client/Contract Compliance, Data Protection, Policies, Access Reviews,
-- Security Incidents, Session/Login Monitoring, Reports). This file extends
-- the two tables that already shipped (compliance_reviews, security_events)
-- with the fields the full spec calls for.

alter table compliance_reviews
  add column if not exists review_number text unique,
  add column if not exists department text,
  add column if not exists start_date date,
  add column if not exists risk_level text,
  add column if not exists corrective_actions text,
  add column if not exists corrective_action_due_date date,
  add column if not exists evidence text;

alter table compliance_reviews
  add constraint compliance_reviews_risk_level_check check (risk_level is null or risk_level in (
    'low', 'medium', 'high', 'critical'
  ));

-- Backfill review numbers for any pre-existing rows so the unique
-- constraint above doesn't choke on nulls, using the same prefix-agnostic
-- sequence function every other module's document numbering already uses.
update compliance_reviews set review_number = next_finance_number('CR') where review_number is null;

alter table security_events
  add column if not exists device text,
  add column if not exists result text;

-- "Investigation Status" in the spec is the existing `status` column
-- (open/investigating/resolved/false_positive) — it already models
-- investigation state, so this is a display-label change on the page, not a
-- new column. `result` is new: the outcome of the event itself (e.g.
-- "blocked", "allowed", "failed"), a distinct concept from investigation
-- status.
