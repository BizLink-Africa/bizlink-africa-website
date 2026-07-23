import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CtoOverview {
  apiAvailabilityPercentage: number | null;
  apiAvgResponseTimeMs: number | null;
  successfulRequestsCount: number;
  failedRequestsCount: number;
  activeIntegrationsCount: number;
  degradedIntegrationsCount: number;
  failedIntegrationsCount: number;
  activeWebhooksCount: number;
  failedWebhookDeliveriesCount: number;
  activeAiAgentsCount: number;
  aiUsageTotal: number;
  failedBackgroundJobsCount: number;
  databaseStatus: string | null;
  storageUsageDetail: string | null;
  backupStatus: string | null;
  activeIncidentsCount: number;
  failedDeploymentsCount: number;
  securityAlertsCount: number;
  platformUptimePercentage: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

// Every number here is derived from tables that manually-tracked staff
// entries populate (this platform has no live telemetry agent) — never
// fabricated. Falls back to null/0 rather than throwing when a table is
// empty, so the dashboard renders honest empty states instead of erroring.
export async function getCtoOverview(supabase: Supabase): Promise<CtoOverview> {
  const [
    { data: apiLogs },
    { data: integrations },
    { data: webhooks },
    { data: agents },
    { data: jobs },
    { data: systemChecks },
    { data: backups },
    { data: incidents },
    { data: deployments },
    { data: securityEvents },
  ] = await Promise.all([
    supabase.from('api_request_logs').select('response_code, response_time_ms'),
    supabase.from('integration_health').select('api_status'),
    supabase.from('webhook_deliveries').select('delivery_status'),
    supabase.from('ai_agent_configs').select('agent_status, usage_count'),
    supabase.from('background_jobs').select('status'),
    supabase.from('system_health_checks').select('component, status, detail'),
    supabase.from('backup_records').select('status, completed_at').order('created_at', { ascending: false }).limit(1),
    supabase.from('technical_incidents').select('status').neq('status', 'resolved'),
    supabase.from('deployments').select('status').eq('status', 'failed'),
    supabase.from('security_events').select('status').in('status', ['open', 'investigating']),
  ]);

  const logs = apiLogs ?? [];
  const successfulRequestsCount = logs.filter((l) => l.response_code < 400).length;
  const failedRequestsCount = logs.filter((l) => l.response_code >= 400).length;
  const apiAvailabilityPercentage = logs.length > 0 ? Math.round((successfulRequestsCount / logs.length) * 1000) / 10 : null;
  const apiAvgResponseTimeMs = average(logs.filter((l) => l.response_time_ms != null).map((l) => l.response_time_ms as number));

  const integrationRows = integrations ?? [];
  const webhookRows = webhooks ?? [];
  const agentRows = agents ?? [];
  const checks = systemChecks ?? [];

  const databaseCheck = checks.find((c) => c.component === 'database');
  const storageCheck = checks.find((c) => c.component === 'storage');
  const operationalCount = checks.filter((c) => c.status === 'operational').length;
  const platformUptimePercentage = checks.length > 0 ? Math.round((operationalCount / checks.length) * 1000) / 10 : null;

  return {
    apiAvailabilityPercentage,
    apiAvgResponseTimeMs,
    successfulRequestsCount,
    failedRequestsCount,
    activeIntegrationsCount: integrationRows.filter((i) => i.api_status === 'active').length,
    degradedIntegrationsCount: integrationRows.filter((i) => i.api_status === 'warning').length,
    failedIntegrationsCount: integrationRows.filter((i) => i.api_status === 'failed').length,
    activeWebhooksCount: webhookRows.filter((w) => w.delivery_status === 'delivered').length,
    failedWebhookDeliveriesCount: webhookRows.filter((w) => w.delivery_status === 'failed').length,
    activeAiAgentsCount: agentRows.filter((a) => a.agent_status === 'active').length,
    aiUsageTotal: agentRows.reduce((sum, a) => sum + (a.usage_count ?? 0), 0),
    failedBackgroundJobsCount: (jobs ?? []).filter((j) => j.status === 'failed').length,
    databaseStatus: databaseCheck?.status ?? null,
    storageUsageDetail: storageCheck?.detail ?? null,
    backupStatus: backups && backups.length > 0 ? backups[0].status : null,
    activeIncidentsCount: (incidents ?? []).length,
    failedDeploymentsCount: (deployments ?? []).length,
    securityAlertsCount: (securityEvents ?? []).length,
    platformUptimePercentage,
  };
}
