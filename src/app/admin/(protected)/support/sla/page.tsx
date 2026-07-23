import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SlaStatePill from '@/components/admin/support/SlaStatePill';
import { TICKET_CATEGORIES, labelFor, computeSlaState, OPEN_TICKET_STATUSES, type Ticket, type SlaRule } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function SlaMonitoringPage() {
  try {
    await requirePermission('tickets.view');
  } catch {
    return <AccessDenied requiredPermission="tickets.view" />;
  }

  const supabase = await createClient();
  const [{ data: tickets, error }, { data: slaRules }] = await Promise.all([
    supabase
      .from('support_tickets')
      .select('*, clients(client_name)')
      .in('status', OPEN_TICKET_STATUSES)
      .order('resolution_deadline', { ascending: true, nullsFirst: false }),
    supabase.from('support_sla_rules').select('*').order('priority'),
  ]);

  const rows = (tickets ?? []) as unknown as (Ticket & { clients: { client_name: string } | null })[];
  const rules = (slaRules ?? []) as SlaRule[];

  const withState = rows.map((t) => {
    const responseState = computeSlaState(t.response_deadline, t.first_response_at);
    const resolutionState = computeSlaState(t.resolution_deadline, t.resolved_at);
    return { ticket: t, responseState, resolutionState };
  });

  const breachedCount = withState.filter((r) => r.responseState === 'breached' || r.resolutionState === 'breached').length;
  const dueSoonCount = withState.filter((r) => r.responseState === 'due_soon' || r.resolutionState === 'due_soon').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">SLA Monitoring</h1>
        <p className="text-sm text-[#707975] mt-1">{breachedCount} breached · {dueSoonCount} due soon · {rows.length} open ticket{rows.length === 1 ? '' : 's'} tracked</p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Priority-Based Rules</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="py-2">Priority</th>
              <th className="py-2">Response Deadline</th>
              <th className="py-2">Resolution Deadline</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.priority} className="border-b border-[#e5e5e5] last:border-0">
                <td className="py-2 text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, r.priority)}</td>
                <td className="py-2 text-[#3f4945]">{r.response_hours}h</td>
                <td className="py-2 text-[#3f4945]">{r.resolution_hours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load tickets: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Response Deadline</th>
              <th className="px-4 py-3">Response SLA</th>
              <th className="px-4 py-3">Resolution Deadline</th>
              <th className="px-4 py-3">Resolution SLA</th>
            </tr>
          </thead>
          <tbody>
            {withState.map(({ ticket, responseState, resolutionState }) => (
              <tr key={ticket.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  <Link href={`/admin/support-tickets/${ticket.id}`} className="hover:underline">{ticket.ticket_number ?? ticket.title}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{ticket.clients?.client_name ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(TICKET_CATEGORIES, ticket.category)}</td>
                <td className="px-4 py-3 text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, ticket.priority)}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{ticket.response_deadline ? new Date(ticket.response_deadline).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                <td className="px-4 py-3">{responseState ? <SlaStatePill state={responseState} /> : '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{ticket.resolution_deadline ? new Date(ticket.resolution_deadline).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                <td className="px-4 py-3">{resolutionState ? <SlaStatePill state={resolutionState} /> : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">No open tickets.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
