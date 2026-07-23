import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import BarListChart from '@/components/admin/dashboard/BarListChart';
import { LEAD_STAGES } from '@/data/inquiries';
import { OPPORTUNITY_STAGES, labelFor } from '@/data/crm';
import { formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

interface OverdueFollowUpRow {
  id: string;
  follow_up_date: string;
  communication_type: string;
  website_leads: { business_name: string } | null;
  clients: { business_name: string } | null;
}

export default async function SalesPipelinePage() {
  try {
    await requirePermission('dashboard.crm.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.crm.view" />;
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: leads }, { data: opportunities }, { data: followUps }, { data: staffRows }] = await Promise.all([
    supabase.from('website_leads').select('stage'),
    supabase
      .from('opportunities')
      .select('id, opportunity_number, name, estimated_value, currency, stage, expected_close_date, owner_user_id')
      .order('expected_close_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('crm_follow_ups')
      .select('id, follow_up_date, communication_type, website_leads(business_name), clients(business_name)')
      .eq('status', 'scheduled')
      .lt('follow_up_date', today)
      .order('follow_up_date', { ascending: true }),
    supabase.from('staff_profiles').select('id, full_name'),
  ]);

  const overdueFollowUps = followUps as unknown as OverdueFollowUpRow[] | null;
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  const leadStageChart = LEAD_STAGES.map((s) => ({
    label: s.label,
    value: (leads ?? []).filter((l) => l.stage === s.value).length,
  }));

  const opportunityStageChart = OPPORTUNITY_STAGES.map((s) => ({
    label: s.label,
    value: (opportunities ?? []).filter((o) => o.stage === s.value).length,
  }));

  const pipelineCurrency = opportunities?.[0]?.currency ?? 'TZS';
  const pipelineValue = (opportunities ?? [])
    .filter((o) => o.stage !== 'won' && o.stage !== 'lost')
    .reduce((s, o) => s + (o.estimated_value ?? 0), 0);

  const upcomingCloses = (opportunities ?? []).filter((o) => o.expected_close_date && o.stage !== 'won' && o.stage !== 'lost').slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/crm" className="text-sm text-[#707975] hover:text-[#00342b]">← Back to CRM Dashboard</Link>
        <h1 className="font-bold text-2xl text-[#00342b] mt-2">Sales Pipeline</h1>
        <p className="text-sm text-[#707975] mt-1">Total open pipeline value: {formatMoney(pipelineValue, pipelineCurrency)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarListChart title="Leads by Stage" data={leadStageChart} />
        <BarListChart title="Opportunities by Stage" data={opportunityStageChart} />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Upcoming Expected Close Dates</h2>
        {upcomingCloses.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Opportunity</th>
                <th className="py-2">Value</th>
                <th className="py-2">Stage</th>
                <th className="py-2">Owner</th>
                <th className="py-2">Expected Close</th>
              </tr>
            </thead>
            <tbody>
              {upcomingCloses.map((o) => (
                <tr key={o.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2"><Link href={`/admin/crm/opportunities/${o.id}`} className="hover:underline text-[#00342b] font-medium">{o.opportunity_number} — {o.name}</Link></td>
                  <td className="py-2 tabular-nums">{formatMoney(o.estimated_value, o.currency)}</td>
                  <td className="py-2">{labelFor(OPPORTUNITY_STAGES, o.stage)}</td>
                  <td className="py-2">{o.owner_user_id ? staffNameById.get(o.owner_user_id) ?? '—' : '—'}</td>
                  <td className="py-2">{o.expected_close_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[#707975]">No opportunities with an expected close date yet.</p>
        )}
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Overdue Follow-ups</h2>
        {overdueFollowUps && overdueFollowUps.length > 0 ? (
          <ul className="divide-y divide-[#e5e5e5]">
            {overdueFollowUps.map((f) => (
              <li key={f.id} className="py-2 text-sm flex items-center justify-between">
                <span>{f.clients?.business_name ?? f.website_leads?.business_name ?? '—'} — {f.communication_type}</span>
                <span className="text-xs text-red-700 font-medium">Due {f.follow_up_date}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#707975]">No overdue follow-ups.</p>
        )}
      </div>
    </div>
  );
}
