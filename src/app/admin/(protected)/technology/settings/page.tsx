import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import TechnologySettingsForm from '@/components/admin/TechnologySettingsForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { setDeploymentEnvironmentActiveOption } from './actions';

export const dynamic = 'force-dynamic';

const ACTIVE_OPTIONS = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] as const;
const INCIDENT_SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

interface TechnologySettingsRow {
  uptime_target_percentage: number;
  api_response_time_target_ms: number;
  incident_alert_email: string | null;
  maintenance_mode: boolean;
  technology_monitoring_interval_minutes: number;
  technology_logs_retention_days: number;
  technology_backups_retention_days: number;
}

interface DeploymentEnvironment {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default async function TechnologySettingsPage() {
  let canManage = true;
  try {
    await requirePermission('technology.settings.view');
  } catch {
    return <AccessDenied requiredPermission="technology.settings.view" />;
  }
  try {
    await requirePermission('technology.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data }, { data: environments }] = await Promise.all([
    supabase
      .from('company_settings')
      .select('uptime_target_percentage, api_response_time_target_ms, incident_alert_email, maintenance_mode, technology_monitoring_interval_minutes, technology_logs_retention_days, technology_backups_retention_days')
      .eq('id', true)
      .single(),
    supabase.from('technology_deployment_environments').select('*').order('name'),
  ]);

  const settings = (data ?? {
    uptime_target_percentage: 99.9,
    api_response_time_target_ms: 500,
    incident_alert_email: null,
    maintenance_mode: false,
    technology_monitoring_interval_minutes: 15,
    technology_logs_retention_days: 90,
    technology_backups_retention_days: 30,
  }) as TechnologySettingsRow;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Technology Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          Monitoring configuration, retention windows, deployment environments, and incident alerting used across the
          Technology module.
        </p>
      </div>

      {canManage ? (
        <TechnologySettingsForm
          initial={{
            uptimeTargetPercentage: settings.uptime_target_percentage,
            apiResponseTimeTargetMs: settings.api_response_time_target_ms,
            incidentAlertEmail: settings.incident_alert_email ?? '',
            maintenanceMode: settings.maintenance_mode,
            monitoringIntervalMinutes: settings.technology_monitoring_interval_minutes,
            logsRetentionDays: settings.technology_logs_retention_days,
            backupsRetentionDays: settings.technology_backups_retention_days,
          }}
        />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Platform Uptime Target:</span> {settings.uptime_target_percentage}%</p>
          <p><span className="font-semibold text-[#707975]">API Response Time Target:</span> {settings.api_response_time_target_ms}ms</p>
          <p><span className="font-semibold text-[#707975]">Incident Alert Email:</span> {settings.incident_alert_email ?? '—'}</p>
          <p><span className="font-semibold text-[#707975]">Maintenance Mode:</span> {settings.maintenance_mode ? 'On' : 'Off'}</p>
          <p><span className="font-semibold text-[#707975]">Monitoring Interval:</span> {settings.technology_monitoring_interval_minutes} min</p>
          <p><span className="font-semibold text-[#707975]">Logs Retention:</span> {settings.technology_logs_retention_days} days</p>
          <p><span className="font-semibold text-[#707975]">Backups Retention:</span> {settings.technology_backups_retention_days} days</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Deployment Environments</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Name</th>
                <th className="py-2">Description</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {((environments ?? []) as DeploymentEnvironment[]).map((env) => (
                <tr key={env.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 text-[#1b1c1c] font-medium">{env.name}</td>
                  <td className="py-2 text-[#707975] text-xs">{env.description ?? '—'}</td>
                  <td className="py-2">
                    {canManage ? (
                      <InlineSelect value={String(env.is_active)} options={ACTIVE_OPTIONS} onSave={setDeploymentEnvironmentActiveOption.bind(null, env.id)} />
                    ) : (
                      <span className="text-xs text-[#3f4945]">{env.is_active ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Incident Severity Levels</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <p className="text-xs text-[#707975] mb-3">
            Fixed levels used across Technical Incidents — not editable here, shown for reference.
          </p>
          <div className="flex gap-2 flex-wrap">
            {INCIDENT_SEVERITIES.map((s) => (
              <span key={s.value} className="px-3 py-1.5 text-xs font-medium border border-[#bfc9c4] text-[#3f4945]">{s.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
