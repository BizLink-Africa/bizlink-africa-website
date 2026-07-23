import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { getSecurityOverview } from '@/lib/dashboard/security-adapters';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function SecurityDashboardPage() {
  try {
    await requirePermission('dashboard.security.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.security.view" />;
  }

  const supabase = await createClient();
  const overview = await getSecurityOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">Security Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load security data.</p>
      </div>
    );
  }

  const mfaValue = overview.mfaTotalStaffCount > 0
    ? `${overview.mfaEnabledCount}/${overview.mfaTotalStaffCount} enabled`
    : '—';

  const activityKpis: Kpi[] = [
    { key: 'failed_logins', label: 'Failed Logins (30d)', value: overview.failedLoginsCount, href: '/admin/security/logins', accent: overview.failedLoginsCount > 0 ? 'warning' : 'default' },
    { key: 'suspicious_logins', label: 'Suspicious Logins (24h)', value: overview.suspiciousLoginsCount, href: '/admin/security/logins', accent: overview.suspiciousLoginsCount > 0 ? 'danger' : 'default' },
    { key: 'active_sessions', label: 'Active Sessions', value: overview.activeSessionsCount, href: '/admin/security/sessions' },
    { key: 'locked_accounts', label: 'Locked Accounts', value: overview.lockedAccountsCount, href: '/admin/staff' },
    { key: 'mfa_status', label: 'MFA Status', value: mfaValue, href: '/admin/staff' },
  ];

  const riskKpis: Kpi[] = [
    { key: 'security_incidents', label: 'Open Security Incidents', value: overview.securityIncidentsCount, href: '/admin/security/incidents', accent: overview.securityIncidentsCount > 0 ? 'danger' : 'default' },
    { key: 'permission_change_alerts', label: 'Permission Change Alerts (30d)', value: overview.permissionChangeAlertsCount, href: '/admin/compliance/security-events' },
    { key: 'api_credential_activity', label: 'API Credential Activity (30d)', value: overview.apiCredentialActivityCount, href: '/admin/operations/provisioning' },
    { key: 'security_risks', label: 'Security Risks', value: overview.securityRisksCount, href: '/admin/compliance/security-events', accent: overview.securityRisksCount > 0 ? 'warning' : 'default' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Security Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">Login activity, session state, and open security risk — built from live login/session data plus manually-tracked incidents and MFA status.</p>
      </div>

      <KpiGrid title="Login & Session Activity" kpis={activityKpis} />
      <KpiGrid title="Risk" kpis={riskKpis} />
    </div>
  );
}
