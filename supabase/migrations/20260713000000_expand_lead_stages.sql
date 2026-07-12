-- Expands the lead pipeline from 8 stages to the 9-stage CRM model used by
-- the Super Admin dashboard: new, contacted, in_discussion, proposal_sent,
-- contract_review, offline_onboarding, active_client, rejected, dormant.
--
-- Backfill (no data loss, just relabeled to fit the new model):
--   documents_requested -> in_discussion   (folded into discussion stage)
--   completed            -> active_client   (a completed engagement is a client)
--   onboarding            -> offline_onboarding (renamed for clarity)

update website_leads set status = 'in_discussion' where status = 'documents_requested';
update website_leads set status = 'active_client' where status = 'completed';
update website_leads set status = 'offline_onboarding' where status = 'onboarding';

alter table website_leads
  drop constraint if exists website_leads_status_check;
alter table website_leads
  add constraint website_leads_status_check check (status in (
    'new', 'contacted', 'in_discussion', 'proposal_sent', 'contract_review',
    'offline_onboarding', 'active_client', 'rejected', 'dormant'
  ));
