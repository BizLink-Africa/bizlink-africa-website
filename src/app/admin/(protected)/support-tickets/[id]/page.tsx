import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { getRecordActivity } from '@/lib/audit';
import InlineSelect from '@/components/admin/InlineSelect';
import SlaStatePill from '@/components/admin/support/SlaStatePill';
import AssignTicketForm from '@/components/admin/support/AssignTicketForm';
import EscalateTicketForm from '@/components/admin/support/EscalateTicketForm';
import AddMessageForm from '@/components/admin/support/AddMessageForm';
import TicketAttachmentLink from '@/components/admin/support/TicketAttachmentLink';
import TicketDetailForm from '@/components/admin/support/TicketDetailForm';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';
import { updateTicketStatus, resolveTicket } from '../actions';
import { TICKET_CATEGORIES, TICKET_STATUSES, ESCALATION_TARGETS, DEPARTMENTS, labelFor, computeSlaState, type Ticket, type TicketMessage, type TicketAttachment, type Department } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';
import { SERVICE_CATALOG } from '@/data/services';

export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('tickets.view');
  } catch {
    return <AccessDenied requiredPermission="tickets.view" />;
  }
  let canUpdate = true;
  try {
    await requirePermission('tickets.update');
  } catch {
    canUpdate = false;
  }
  let canAssign = true;
  try {
    await requirePermission('tickets.assign');
  } catch {
    canAssign = false;
  }
  let canEscalate = true;
  try {
    await requirePermission('tickets.escalate');
  } catch {
    canEscalate = false;
  }
  let canResolve = true;
  try {
    await requirePermission('tickets.resolve');
  } catch {
    canResolve = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: ticket, error }, { data: staffRows }, { data: messages }, activity] = await Promise.all([
    supabase.from('support_tickets').select('*, clients(id, client_name, business_name)').eq('id', id).single(),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('support_ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
    getRecordActivity(supabase, 'support_tickets', id),
  ]);

  if (error || !ticket) notFound();
  const t = ticket as Ticket & { clients: { id: string; client_name: string; business_name: string } | null };

  const [{ data: services }, { data: integrations }, { data: aiAgents }, { data: attachments }] = await Promise.all([
    t.client_id ? supabase.from('client_services').select('id, service_key').eq('client_id', t.client_id) : Promise.resolve({ data: [] }),
    t.client_id ? supabase.from('integration_health').select('id, service_type').eq('client_id', t.client_id) : Promise.resolve({ data: [] }),
    t.client_id ? supabase.from('ai_agent_configs').select('id, agent_type').eq('client_id', t.client_id) : Promise.resolve({ data: [] }),
    supabase.from('support_ticket_attachments').select('*').in('message_id', (messages ?? []).map((m) => m.id)),
  ]);

  const messageRows = (messages ?? []) as TicketMessage[];
  const attachmentRows = (attachments ?? []) as TicketAttachment[];
  const attachmentsByMessage = new Map<string, TicketAttachment[]>();
  for (const a of attachmentRows) {
    attachmentsByMessage.set(a.message_id, [...(attachmentsByMessage.get(a.message_id) ?? []), a]);
  }
  const internalNotes = messageRows.filter((m) => m.is_internal);
  const clientMessages = messageRows.filter((m) => !m.is_internal);

  const responseState = computeSlaState(t.response_deadline, t.first_response_at);
  const resolutionState = computeSlaState(t.resolution_deadline, t.resolved_at);

  const stageOptions = TICKET_STATUSES.filter((s) => s.value !== 'resolved' && s.value !== 'escalated').map((s) => ({ value: s.value, label: s.label }));

  function renderMessage(m: TicketMessage) {
    return (
      <li key={m.id} className="border-b border-[#e5e5e5] last:border-0 pb-3 last:pb-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#00342b]">{m.author}</span>
          <span className="text-xs text-[#707975]">{new Date(m.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        <p className="text-sm text-[#3f4945] mt-1 whitespace-pre-wrap">{m.message}</p>
        {(attachmentsByMessage.get(m.id) ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {(attachmentsByMessage.get(m.id) ?? []).map((a) => (
              <TicketAttachmentLink key={a.id} filePath={a.file_path} fileName={a.file_name} />
            ))}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/support-tickets" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Support Tickets
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-bold text-2xl text-[#00342b]">{t.ticket_number ?? t.title}</h1>
            <p className="text-sm text-[#707975] mt-1">{t.title} — {t.clients?.client_name ?? 'No client linked'}</p>
          </div>
          <div className="flex items-center gap-2">
            {responseState && <SlaStatePill state={responseState} />}
            {resolutionState && <SlaStatePill state={resolutionState} />}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Status &amp; Actions</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</p>
            {canUpdate ? (
              <InlineSelect value={t.status} options={stageOptions} onSave={updateTicketStatus.bind(null, id)} />
            ) : (
              labelFor(TICKET_STATUSES, t.status)
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Priority</p>
            <p className="text-sm text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, t.priority)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Category</p>
            <p className="text-sm text-[#3f4945]">{labelFor(TICKET_CATEGORIES, t.category)}</p>
          </div>
          {canResolve && t.status !== 'resolved' && (
            <form action={async () => { 'use server'; await resolveTicket(id); }}>
              <button type="submit" className="bg-[#1b7a3d] text-white px-4 py-2 text-sm font-medium hover:bg-[#146030] transition-colors">
                Mark Resolved
              </button>
            </form>
          )}
        </div>
        {t.escalated_to && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-4">
            Escalated to {labelFor(ESCALATION_TARGETS, t.escalated_to)}
            {t.escalation_reason && ` — ${t.escalation_reason}`}
            {t.escalated_at && ` (${new Date(t.escalated_at).toLocaleDateString('en-GB')})`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canAssign && (
          <div className="bg-white border border-[#bfc9c4] p-6">
            <h2 className="font-semibold text-[#00342b] mb-4">Assignment</h2>
            <AssignTicketForm ticketId={id} initialAssignedUserId={t.assigned_user_id ?? ''} staff={staffRows ?? []} />
          </div>
        )}
        {canEscalate && (
          <div className="bg-white border border-[#bfc9c4] p-6">
            <h2 className="font-semibold text-[#00342b] mb-4">Escalate</h2>
            <EscalateTicketForm ticketId={id} />
          </div>
        )}
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">SLA Deadlines</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-[#707975] uppercase tracking-wider">Response Deadline</dt><dd className="text-[#1b1c1c]">{t.response_deadline ? new Date(t.response_deadline).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd></div>
          <div><dt className="text-xs text-[#707975] uppercase tracking-wider">Resolution Deadline</dt><dd className="text-[#1b1c1c]">{t.resolution_deadline ? new Date(t.resolution_deadline).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd></div>
          <div><dt className="text-xs text-[#707975] uppercase tracking-wider">First Response</dt><dd className="text-[#1b1c1c]">{t.first_response_at ? new Date(t.first_response_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd></div>
          <div><dt className="text-xs text-[#707975] uppercase tracking-wider">Resolved At</dt><dd className="text-[#1b1c1c]">{t.resolved_at ? new Date(t.resolved_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd></div>
        </dl>
      </div>

      {canUpdate ? (
        <TicketDetailForm
          ticketId={id}
          initialDescription={t.description ?? ''}
          initialContactPerson={t.contact_person ?? ''}
          initialContactEmail={t.contact_email ?? ''}
          initialDepartment={(t.department ?? '') as Department | ''}
          initialRelatedServiceId={t.related_service_id ?? ''}
          initialRelatedIntegrationId={t.related_integration_id ?? ''}
          initialRelatedAiAgentId={t.related_ai_agent_id ?? ''}
          services={(services ?? []).map((s) => ({ id: s.id, label: SERVICE_CATALOG.find((c) => c.value === s.service_key)?.label ?? s.service_key }))}
          integrations={(integrations ?? []).map((i) => ({ id: i.id, label: i.service_type }))}
          aiAgents={(aiAgents ?? []).map((a) => ({ id: a.id, label: a.agent_type }))}
        />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Description:</span> {t.description ?? '—'}</p>
          <p><span className="font-semibold text-[#707975]">Contact:</span> {t.contact_person ?? '—'} ({t.contact_email ?? '—'})</p>
          <p><span className="font-semibold text-[#707975]">Department:</span> {t.department ? labelFor(DEPARTMENTS, t.department) : '—'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-1">Client Conversation</h2>
          <p className="text-xs text-[#707975] mb-4">Client-visible replies only — never shown here are internal notes.</p>
          {clientMessages.length === 0 ? (
            <p className="text-sm text-[#707975] mb-4">No replies yet.</p>
          ) : (
            <ul className="space-y-3 mb-4">{clientMessages.map(renderMessage)}</ul>
          )}
          {canUpdate && <AddMessageForm ticketId={id} isInternal={false} />}
        </div>

        <div className="bg-[#fef9ec] border border-[#eadfb0] p-6">
          <h2 className="font-semibold text-[#8a5a00] mb-1">Internal Notes</h2>
          <p className="text-xs text-[#8a6d1f] mb-4">Staff-only — never visible to the client.</p>
          {internalNotes.length === 0 ? (
            <p className="text-sm text-[#8a6d1f] mb-4">No internal notes yet.</p>
          ) : (
            <ul className="space-y-3 mb-4">{internalNotes.map(renderMessage)}</ul>
          )}
          {canUpdate && <AddMessageForm ticketId={id} isInternal={true} />}
        </div>
      </div>

      <ActivityTimeline entries={activity} />
    </div>
  );
}
