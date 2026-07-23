import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { SECURITY_INCIDENT_SEVERITIES, SECURITY_INCIDENT_STATUSES, type SecurityIncident, type SecurityIncidentUpdate } from '@/data/securityIncidents';
import { labelFor } from '@/data/compliance';
import { maskSecrets } from '@/lib/security/mask';
import SecurityIncidentTimelineForm from '@/components/admin/compliance/SecurityIncidentTimelineForm';
import SecurityIncidentContainmentForm from '@/components/admin/compliance/SecurityIncidentContainmentForm';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function SecurityIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await requirePermission('security_incidents.view');
  } catch {
    return <AccessDenied requiredPermission="security_incidents.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('security_incidents.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: incident, error }, { data: updates }] = await Promise.all([
    supabase.from('security_incidents').select('*').eq('id', id).single(),
    supabase.from('security_incident_updates').select('*').eq('incident_id', id).order('created_at', { ascending: false }),
  ]);

  if (error || !incident) {
    notFound();
  }

  const row = incident as SecurityIncident;
  const timeline = (updates ?? []) as SecurityIncidentUpdate[];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/security/incidents" className="inline-flex items-center gap-1 text-sm text-[#00342b] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to Security Incidents
      </Link>

      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">{row.title}</h1>
        <p className="text-sm text-[#707975] mt-1">
          {row.incident_number ?? '—'} · {labelFor(SECURITY_INCIDENT_SEVERITIES, row.severity)} severity · {labelFor(SECURITY_INCIDENT_STATUSES, row.status)} · Detected {formatDateTime(row.detection_date)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-4">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Affected Systems</p>
          <p className="text-sm text-[#1b1c1c]">{row.affected_systems.join(', ') || '—'}</p>
        </div>
        <div className="bg-white border border-[#bfc9c4] p-4">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Affected Users</p>
          <p className="text-sm text-[#1b1c1c]">{row.affected_users.join(', ') || '—'}</p>
        </div>
      </div>

      {canManage ? (
        <div className="space-y-6 mb-6">
          <SecurityIncidentContainmentForm id={row.id} initialContainment={row.containment} initialResolution={row.resolution} initialOwner={row.owner} />
          <SecurityIncidentTimelineForm id={row.id} currentStatus={row.status} />
        </div>
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-4 space-y-2 text-sm mb-6">
          <p><span className="font-semibold text-[#707975]">Owner:</span> {row.owner ?? '—'}</p>
          <p><span className="font-semibold text-[#707975]">Containment:</span> {maskSecrets(row.containment)}</p>
          <p><span className="font-semibold text-[#707975]">Resolution:</span> {maskSecrets(row.resolution)}</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-[#00342b] mb-3">Timeline</h2>
        <div className="space-y-3">
          {timeline.map((entry) => (
            <div key={entry.id} className="bg-white border border-[#bfc9c4] p-3">
              <div className="flex items-center justify-between text-xs text-[#707975] mb-1">
                <span>{entry.created_by ?? 'Unknown'}{entry.status_at_update ? ` · marked ${labelFor(SECURITY_INCIDENT_STATUSES, entry.status_at_update)}` : ''}</span>
                <span>{formatDateTime(entry.created_at)}</span>
              </div>
              <p className="text-sm text-[#1b1c1c]">{maskSecrets(entry.note)}</p>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-[#707975]">No timeline updates yet.</p>}
        </div>
      </div>
    </div>
  );
}
