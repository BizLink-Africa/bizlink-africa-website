import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { SECURITY_INCIDENT_SEVERITIES, SECURITY_INCIDENT_STATUSES, OPEN_SECURITY_INCIDENT_STATUSES, type SecurityIncident } from '@/data/securityIncidents';
import { labelFor } from '@/data/compliance';
import AddSecurityIncidentForm from '@/components/admin/compliance/AddSecurityIncidentForm';

export const dynamic = 'force-dynamic';

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-[#707975]',
  medium: 'text-[#8a5a00]',
  high: 'text-[#8a5a00]',
  critical: 'text-[#8a1f1f]',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'text-[#8a1f1f]',
  investigating: 'text-[#8a5a00]',
  contained: 'text-[#8a5a00]',
  resolved: 'text-[#1b7a3d]',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function SecurityIncidentsPage() {
  let canManage = true;
  try {
    await requirePermission('security_incidents.view');
  } catch {
    return <AccessDenied requiredPermission="security_incidents.view" />;
  }
  try {
    await requirePermission('security_incidents.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('security_incidents').select('*').order('created_at', { ascending: false });
  const incidents = (data ?? []) as SecurityIncident[];
  const activeCount = incidents.filter((i) => OPEN_SECURITY_INCIDENT_STATUSES.includes(i.status)).length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Security Incidents</h1>
          <p className="text-sm text-[#707975] mt-1">{activeCount} active incident{activeCount === 1 ? '' : 's'}</p>
        </div>
        {canManage && <AddSecurityIncidentForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load security incidents: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Incident #</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Affected Systems</th>
              <th className="px-4 py-3">Affected Users</th>
              <th className="px-4 py-3">Detected</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-mono text-xs text-[#3f4945]">{incident.incident_number ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{incident.title}</td>
                <td className={`px-4 py-3 text-xs font-medium ${SEVERITY_COLORS[incident.severity] ?? ''}`}>{labelFor(SECURITY_INCIDENT_SEVERITIES, incident.severity)}</td>
                <td className={`px-4 py-3 text-xs font-medium ${STATUS_COLORS[incident.status] ?? ''}`}>{labelFor(SECURITY_INCIDENT_STATUSES, incident.status)}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{incident.affected_systems.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{incident.affected_users.length || '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(incident.detection_date)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{incident.owner ?? '—'}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/security/incidents/${incident.id}`} className="text-xs font-medium text-[#00342b] hover:underline">
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {incidents.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No security incidents recorded — nothing open.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
