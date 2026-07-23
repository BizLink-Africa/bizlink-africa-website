import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { TICKET_CATEGORIES, TICKET_STATUSES, labelFor, computeSlaState, type Ticket } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';
import NewTicketForm from '@/components/admin/NewTicketForm';
import InlineSelect from '@/components/admin/InlineSelect';
import SlaStatePill from '@/components/admin/support/SlaStatePill';
import { updateTicketStatus } from './actions';

export const dynamic = 'force-dynamic';

interface TicketRow extends Ticket {
  clients: { client_name: string; business_name: string } | null;
}

export default async function SupportTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  let hasCreatePermission = true;
  try {
    await requirePermission('tickets.view');
  } catch {
    return <AccessDenied requiredPermission="tickets.view" />;
  }
  try {
    await requirePermission('tickets.create');
  } catch {
    hasCreatePermission = false;
  }

  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: staffRows }] = await Promise.all([
    supabase.from('clients').select('id, client_name, business_name').order('client_name', { ascending: true }),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  let query = supabase
    .from('support_tickets')
    .select('*, clients(client_name, business_name)')
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.category) query = query.eq('category', params.category);

  const { data, error } = await query;
  const tickets = (data ?? []) as unknown as TicketRow[];
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Support Tickets</h1>
          <p className="text-sm text-[#707975] mt-1">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</p>
        </div>
        {hasCreatePermission && <NewTicketForm clients={clients ?? []} staff={staffRows ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load tickets: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Created</th>
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
                  <td className="px-4 py-3">
                    <InlineSelect
                      value={ticket.status}
                      options={TICKET_STATUSES}
                      onSave={updateTicketStatus.bind(null, ticket.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{ticket.assigned_user_id ? staffNameById.get(ticket.assigned_user_id) ?? '—' : ticket.assigned_staff ?? '—'}</td>
                  <td className="px-4 py-3">{worstState ? <SlaStatePill state={worstState} /> : '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                    {new Date(ticket.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No support tickets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
