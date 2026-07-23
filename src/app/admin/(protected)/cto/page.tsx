import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { getCtoOverview } from '@/lib/dashboard/cto-adapters';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

function ms(value: number | null): string {
  return value === null ? '—' : `${value}ms`;
}

function statusLabel(value: string | null): string {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export default async function CtoDashboardPage() {
  try {
    await requirePermission('dashboard.technical.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.technical.view" />;
  }

  const supabase = await createClient();
  const overview = await getCtoOverview(supabase);

  const platformKpis: Kpi[] = [
    { key: 'platform_uptime', label: 'Platform Uptime', value: pct(overview.platformUptimePercentage), href: '/admin/system-health' },
    { key: 'api_availability', label: 'API Availability', value: pct(overview.apiAvailabilityPercentage), href: '/admin/api-monitoring' },
    { key: 'api_response_time', label: 'API Response Time', value: ms(overview.apiAvgResponseTimeMs), href: '/admin/api-monitoring' },
    { key: 'successful_requests', label: 'Successful Requests', value: overview.successfulRequestsCount, href: '/admin/api-monitoring' },
    { key: 'failed_requests', label: 'Failed Requests', value: overview.failedRequestsCount, href: '/admin/api-monitoring', accent: overview.failedRequestsCount > 0 ? 'warning' : 'default' },
  ];

  const integrationKpis: Kpi[] = [
    { key: 'active_integrations', label: 'Active Integrations', value: overview.activeIntegrationsCount, href: '/admin/integration-health', accent: 'success' },
    { key: 'degraded_integrations', label: 'Degraded Integrations', value: overview.degradedIntegrationsCount, href: '/admin/integration-health', accent: overview.degradedIntegrationsCount > 0 ? 'warning' : 'default' },
    { key: 'failed_integrations', label: 'Failed Integrations', value: overview.failedIntegrationsCount, href: '/admin/integration-health', accent: overview.failedIntegrationsCount > 0 ? 'danger' : 'default' },
    { key: 'active_webhooks', label: 'Active Webhooks', value: overview.activeWebhooksCount, href: '/admin/webhook-monitoring' },
    { key: 'failed_webhook_deliveries', label: 'Failed Webhook Deliveries', value: overview.failedWebhookDeliveriesCount, href: '/admin/webhook-monitoring', accent: overview.failedWebhookDeliveriesCount > 0 ? 'danger' : 'default' },
  ];

  const platformOpsKpis: Kpi[] = [
    { key: 'active_ai_agents', label: 'Active AI Agents', value: overview.activeAiAgentsCount, href: '/admin/ai-agents' },
    { key: 'ai_usage', label: 'AI Usage', value: overview.aiUsageTotal, href: '/admin/ai-agents' },
    { key: 'failed_background_jobs', label: 'Failed Background Jobs', value: overview.failedBackgroundJobsCount, href: '/admin/background-jobs', accent: overview.failedBackgroundJobsCount > 0 ? 'danger' : 'default' },
    { key: 'database_status', label: 'Database Status', value: statusLabel(overview.databaseStatus), href: '/admin/database-health' },
    { key: 'storage_usage', label: 'Storage Usage', value: overview.storageUsageDetail ?? '—', href: '/admin/system-health' },
    { key: 'backup_status', label: 'Backup Status', value: statusLabel(overview.backupStatus), href: '/admin/backup-monitoring' },
  ];

  const riskKpis: Kpi[] = [
    { key: 'active_incidents', label: 'Active Incidents', value: overview.activeIncidentsCount, href: '/admin/technical-incidents', accent: overview.activeIncidentsCount > 0 ? 'danger' : 'default' },
    { key: 'failed_deployments', label: 'Failed Deployments', value: overview.failedDeploymentsCount, href: '/admin/deployments', accent: overview.failedDeploymentsCount > 0 ? 'warning' : 'default' },
    { key: 'security_alerts', label: 'Security Alerts', value: overview.securityAlertsCount, href: '/admin/compliance/security-events', accent: overview.securityAlertsCount > 0 ? 'danger' : 'default' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">CTO Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">
          Platform, integration, and technical-risk health across every module — built from live tables, not simulated telemetry.
        </p>
      </div>

      <KpiGrid title="Platform" kpis={platformKpis} />
      <KpiGrid title="Integrations & Webhooks" kpis={integrationKpis} />
      <KpiGrid title="AI, Jobs & Infrastructure" kpis={platformOpsKpis} />
      <KpiGrid title="Risk" kpis={riskKpis} />
    </div>
  );
}
