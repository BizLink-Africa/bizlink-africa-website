-- Technology module build-out (CTO Dashboard, Integration Health, AI Agents,
-- API/Webhook Monitoring, Deployments, Background Jobs, Technical Incidents,
-- System/Database Health, Backup Monitoring, Technical Reports/Settings).
-- This file extends the two tables that already shipped (integration_health,
-- ai_agent_configs) with the extra columns the full spec calls for, and
-- tightens their RLS from the original "any authenticated user" policies to
-- has_permission()-gated ones — matching the pattern every module built
-- since 20260729060000 uses (see that migration for the same fix applied to
-- support_tickets).

alter table integration_health
  add column if not exists integration_type text,
  add column if not exists environment text not null default 'production',
  add column if not exists technical_owner text,
  add column if not exists incident_status text not null default 'none',
  add column if not exists success_rate_percentage numeric,
  add column if not exists avg_response_time_ms integer,
  add column if not exists webhook_status text not null default 'not_configured';

alter table integration_health
  add constraint integration_health_integration_type_check check (integration_type is null or integration_type in (
    'payment_gateway', 'sms_gateway', 'email_provider', 'ai_agent', 'social_commerce', 'accounting', 'logistics', 'other'
  ));
alter table integration_health
  add constraint integration_health_environment_check check (environment in ('production', 'staging', 'sandbox'));
alter table integration_health
  add constraint integration_health_incident_status_check check (incident_status in (
    'none', 'investigating', 'identified', 'monitoring', 'resolved'
  ));
alter table integration_health
  add constraint integration_health_webhook_status_check check (webhook_status in (
    'not_configured', 'active', 'failing', 'disabled'
  ));

drop policy if exists "Authenticated can view integration health" on integration_health;
drop policy if exists "Authenticated can insert integration health" on integration_health;
drop policy if exists "Authenticated can update integration health" on integration_health;

create policy "integrations.view can select integration_health" on integration_health for select to authenticated using (has_permission('integrations.view'));
create policy "integrations.manage can insert integration_health" on integration_health for insert to authenticated with check (has_permission('integrations.manage'));
create policy "integrations.manage can update integration_health" on integration_health for update to authenticated using (has_permission('integrations.manage')) with check (has_permission('integrations.manage'));

alter table ai_agent_configs
  add column if not exists agent_name text,
  add column if not exists channel text,
  add column if not exists deployment_status text not null default 'not_deployed',
  add column if not exists usage_count integer not null default 0,
  add column if not exists last_activity_at timestamp with time zone,
  add column if not exists technical_owner text;

alter table ai_agent_configs
  add constraint ai_agent_configs_channel_check check (channel is null or channel in (
    'whatsapp', 'web_chat', 'facebook_messenger', 'instagram', 'sms', 'voice'
  ));
alter table ai_agent_configs
  add constraint ai_agent_configs_deployment_status_check check (deployment_status in (
    'not_deployed', 'deploying', 'deployed', 'failed'
  ));

drop policy if exists "Authenticated can view ai agent configs" on ai_agent_configs;
drop policy if exists "Authenticated can insert ai agent configs" on ai_agent_configs;
drop policy if exists "Authenticated can update ai agent configs" on ai_agent_configs;

create policy "ai_agents.view can select ai_agent_configs" on ai_agent_configs for select to authenticated using (has_permission('ai_agents.view'));
create policy "ai_agents.manage can insert ai_agent_configs" on ai_agent_configs for insert to authenticated with check (has_permission('ai_agents.manage'));
create policy "ai_agents.manage can update ai_agent_configs" on ai_agent_configs for update to authenticated using (has_permission('ai_agents.manage')) with check (has_permission('ai_agents.manage'));
