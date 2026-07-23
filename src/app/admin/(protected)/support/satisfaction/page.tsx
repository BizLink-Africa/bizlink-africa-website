import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import RecordCsatForm from '@/components/admin/support/RecordCsatForm';
import type { CsatEntry } from '@/data/tickets';

export const dynamic = 'force-dynamic';

export default async function CustomerSatisfactionPage() {
  let canManage = true;
  try {
    await requirePermission('csat.view');
  } catch {
    return <AccessDenied requiredPermission="csat.view" />;
  }
  try {
    await requirePermission('csat.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: entries, error }, { data: tickets }, { data: staffRows }, { data: clients }] = await Promise.all([
    supabase.from('support_ticket_satisfaction').select('*').order('created_at', { ascending: false }),
    supabase.from('support_tickets').select('id, ticket_number, title, client_id').order('created_at', { ascending: false }),
    supabase.from('staff_profiles').select('id, full_name'),
    supabase.from('clients').select('id, business_name'),
  ]);

  const rows = (entries ?? []) as CsatEntry[];
  const ticketById = new Map((tickets ?? []).map((t) => [t.id, t]));
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.business_name]));
  const average = rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Customer Satisfaction</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} rating{rows.length === 1 ? '' : 's'} {average !== null && `— average ${average} / 5`}</p>
        </div>
        {canManage && <RecordCsatForm tickets={tickets ?? []} staff={staffRows ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load ratings: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Feedback</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ticket = ticketById.get(r.ticket_id);
              return (
                <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#1b1c1c]">{ticket?.ticket_number ?? ticket?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.client_id ? clientNameById.get(r.client_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.agent_user_id ? staffNameById.get(r.agent_user_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{r.rating} / 5</td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.feedback ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#707975]">{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No ratings recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
