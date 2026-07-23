import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, type TechnicalIncident, type IncidentUpdate } from '@/data/technicalIncidents';
import { labelFor } from '@/data/inquiries';
import IncidentTimelineForm from '@/components/admin/IncidentTimelineForm';
import IncidentRootCauseForm from '@/components/admin/IncidentRootCauseForm';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await requirePermission('incidents.view');
  } catch {
    return <AccessDenied requiredPermission="incidents.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('incidents.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: incident, error }, { data: updates }, { data: affectedClients }] = await Promise.all([
    supabase.from('technical_incidents').select('*').eq('id', id).single(),
    supabase.from('technical_incident_updates').select('*').eq('incident_id', id).order('created_at', { ascending: false }),
    supabase.from('clients').select('id, client_name').limit(1000),
  ]);

  if (error || !incident) {
    notFound();
  }

  const row = incident as TechnicalIncident;
  const timeline = (updates ?? []) as IncidentUpdate[];
  const clientNameById = new Map((affectedClients ?? []).map((c) => [c.id, c.client_name]));

  return (
    <div className="max-w-4xl">
      <Link href="/admin/technical-incidents" className="inline-flex items-center gap-1 text-sm text-[#00342b] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to Technical Incidents
      </Link>

      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">{row.title}</h1>
        <p className="text-sm text-[#707975] mt-1">
          {labelFor(INCIDENT_SEVERITIES, row.severity)} severity · {labelFor(INCIDENT_STATUSES, row.status)} · Opened {formatDateTime(row.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-4">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Affected Systems</p>
          <p className="text-sm text-[#1b1c1c]">{row.affected_systems.join(', ') || '—'}</p>
        </div>
        <div className="bg-white border border-[#bfc9c4] p-4">
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Affected Clients</p>
          <p className="text-sm text-[#1b1c1c]">
            {row.affected_clients.length > 0
              ? row.affected_clients.map((cid) => clientNameById.get(cid) ?? cid).join(', ')
              : '—'}
          </p>
        </div>
      </div>

      {canManage ? (
        <div className="space-y-6 mb-6">
          <IncidentRootCauseForm id={row.id} initialRootCause={row.root_cause} initialResolution={row.resolution} />
          <IncidentTimelineForm id={row.id} currentStatus={row.status} />
        </div>
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-4 space-y-2 text-sm mb-6">
          <p><span className="font-semibold text-[#707975]">Root Cause:</span> {row.root_cause ?? '—'}</p>
          <p><span className="font-semibold text-[#707975]">Resolution:</span> {row.resolution ?? '—'}</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-[#00342b] mb-3">Timeline</h2>
        <div className="space-y-3">
          {timeline.map((entry) => (
            <div key={entry.id} className="bg-white border border-[#bfc9c4] p-3">
              <div className="flex items-center justify-between text-xs text-[#707975] mb-1">
                <span>{entry.created_by ?? 'Unknown'}{entry.status_at_update ? ` · marked ${labelFor(INCIDENT_STATUSES, entry.status_at_update)}` : ''}</span>
                <span>{formatDateTime(entry.created_at)}</span>
              </div>
              <p className="text-sm text-[#1b1c1c]">{entry.note}</p>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-[#707975]">No timeline updates yet.</p>}
        </div>
      </div>
    </div>
  );
}
