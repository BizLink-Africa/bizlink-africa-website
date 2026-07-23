import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SlaStatePill from '@/components/admin/support/SlaStatePill';
import { TICKET_CATEGORIES, TICKET_STATUSES, ESCALATION_TARGETS, labelFor, computeSlaState, OPEN_TICKET_STATUSES, type Ticket } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';

// Shared by Support Tickets' Assigned/Unassigned/Escalations sidebar
// items — same underlying support_tickets table, filtered differently.
// Same "one shared body, thin route wrappers" pattern as
// ReferralPartnershipPageBody from the Marketing session.
export default async function TicketListBody({
  filter,
  title,
  description,
  requiredPermission = 'tickets.view',
}: {
  filter: 'assigned' | 'unassigned' | 'escalated';
  title: string;
  description: string;
  requiredPermission?: string;
}) {
  try {
    await requirePermission(requiredPermission);
  } catch {
    return <AccessDenied requiredPermission={requiredPermission} />;
  }

  const supabase = await createClient();
  let query = supabase.from('support_tickets').select('*, clients(client_name, business_name)').order('created_at', { ascending: false });

  if (filter === 'assigned') {
    query = query.not('assigned_user_id', 'is', null).in('status', OPEN_TICKET_STATUSES);
  } else if (filter === 'unassigned') {
    query = query.is('assigned_user_id', null).in('status', OPEN_TICKET_STATUSES);
  } else {
    query = query.eq('status', 'escalated');
  }

  const [{ data, error }, { data: staffRows }] = await Promise.all([
    query,
    supabase.from('staff_profiles').select('id, full_name'),
  ]);

  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));
  const tickets = (data ?? []) as unknown as (Ticket & { clients: { client_name: string; business_name: string } | null })[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">{title}</h1>
        <p className="text-sm text-[#707975] mt-1">{description} — {tickets.length} ticket{tickets.length === 1 ? '' : 's'}</p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load tickets: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Agent</th>
              {filter === 'escalated' && <th className="px-4 py-3">Escalated To</th>}
              <th className="px-4 py-3">SLA</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => {
              const responseState = computeSlaState(ticket.response_deadline, ticket.first_response_at);
              const resolutionState = computeSlaState(ticket.resolution_deadline, ticket.resolved_at);
              const worstState = resolutionState === 'breached' || responseState === 'breached' ? 'breached'
                : resolutionState === 'due_soon' || responseState === 'due_soon' ? 'due_soon'
                : resolutionState ?? responseState;
              return (
                <tr key={ticket.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#00342b]">
                    <Link href={`/admin/support-tickets/${ticket.id}`} className="hover:underline">{ticket.ticket_number ?? ticket.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{ticket.clients?.client_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{labelFor(TICKET_CATEGORIES, ticket.category)}</td>
                  <td className="px-4 py-3 text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, ticket.priority)}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{labelFor(TICKET_STATUSES, ticket.status)}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{ticket.assigned_user_id ? staffNameById.get(ticket.assigned_user_id) ?? '—' : '—'}</td>
                  {filter === 'escalated' && <td className="px-4 py-3 text-[#3f4945]">{ticket.escalated_to ? labelFor(ESCALATION_TARGETS, ticket.escalated_to) : '—'}</td>}
                  <td className="px-4 py-3">{worstState ? <SlaStatePill state={worstState} /> : '—'}</td>
                </tr>
              );
            })}
            {tickets.length === 0 && !error && (
              <tr>
                <td colSpan={filter === 'escalated' ? 7 : 6} className="px-4 py-10 text-center text-sm text-[#707975]">Nothing here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
