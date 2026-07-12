import { createClient } from '@/lib/supabase/server';
import { TICKET_CATEGORIES, TICKET_STATUSES, type Ticket } from '@/data/tickets';
import { labelFor } from '@/data/inquiries';
import NewTicketForm from '@/components/admin/NewTicketForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { updateTicketStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  open: 'text-[#00342b]',
  in_progress: 'text-[#8a5a00]',
  waiting_client: 'text-[#3d3d9e]',
  resolved: 'text-[#1b7a3d]',
  closed: 'text-[#707975]',
};

interface TicketRow extends Ticket {
  clients: { client_name: string; business_name: string } | null;
}

export default async function SupportTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name, business_name')
    .order('client_name', { ascending: true });

  let query = supabase
    .from('support_tickets')
    .select('*, clients(client_name, business_name)')
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.category) query = query.eq('category', params.category);

  const { data, error } = await query;
  const tickets = (data ?? []) as unknown as TicketRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Support Tickets</h1>
          <p className="text-sm text-[#707975] mt-1">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</p>
        </div>
        <NewTicketForm clients={clients ?? []} />
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load tickets: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned Staff</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{ticket.title}</td>
                <td className="px-4 py-3 text-[#3f4945]">{ticket.clients?.client_name ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(TICKET_CATEGORIES, ticket.category)}</td>
                <td className="px-4 py-3 text-[#3f4945] capitalize">{ticket.priority}</td>
                <td className="px-4 py-3">
                  <InlineSelect
                    value={ticket.status}
                    options={TICKET_STATUSES}
                    onSave={updateTicketStatus.bind(null, ticket.id)}
                    className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[ticket.status] ?? ''}`}
                  />
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{ticket.assigned_staff ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                  {new Date(ticket.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                  {new Date(ticket.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
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
