import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, type TechnicalIncident } from '@/data/technicalIncidents';
import { labelFor } from '@/data/inquiries';
import AddIncidentForm from '@/components/admin/AddIncidentForm';

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
  identified: 'text-[#8a5a00]',
  monitoring: 'text-[#8a5a00]',
  resolved: 'text-[#1b7a3d]',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function TechnicalIncidentsPage() {
  let canManage = true;
  try {
    await requirePermission('incidents.view');
  } catch {
    return <AccessDenied requiredPermission="incidents.view" />;
  }
  try {
    await requirePermission('incidents.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: clients }, { data, error }] = await Promise.all([
    supabase.from('clients').select('id, client_name, business_name').order('client_name', { ascending: true }),
    supabase.from('technical_incidents').select('*').order('created_at', { ascending: false }),
  ]);

  const incidents = (data ?? []) as TechnicalIncident[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Technical Incidents</h1>
          <p className="text-sm text-[#707975] mt-1">{incidents.filter((i) => i.status !== 'resolved').length} active incident{incidents.filter((i) => i.status !== 'resolved').length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <AddIncidentForm clients={clients ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load incidents: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Affected Systems</th>
              <th className="px-4 py-3">Affected Clients</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3">Resolved</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{incident.title}</td>
                <td className={`px-4 py-3 text-xs font-medium capitalize ${SEVERITY_COLORS[incident.severity] ?? ''}`}>{labelFor(INCIDENT_SEVERITIES, incident.severity)}</td>
                <td className={`px-4 py-3 text-xs font-medium ${STATUS_COLORS[incident.status] ?? ''}`}>{labelFor(INCIDENT_STATUSES, incident.status)}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{incident.affected_systems.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{incident.affected_clients.length || '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(incident.created_at)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(incident.resolved_at)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/technical-incidents/${incident.id}`} className="text-xs font-medium text-[#00342b] hover:underline">
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {incidents.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No technical incidents recorded — nothing open.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
