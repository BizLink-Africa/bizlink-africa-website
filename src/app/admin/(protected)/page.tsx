import { createClient } from '@/lib/supabase/server';
import { INQUIRY_STATUSES } from '@/data/inquiries';
import LeadsByStageChart from '@/components/admin/LeadsByStageChart';
import NotificationStatusChart from '@/components/admin/NotificationStatusChart';

export const dynamic = 'force-dynamic';

const CARD_ACCENT_DANGER = new Set(['Failed Notifications']);

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ data: leadRows }, { count: activeClients }, { count: openTickets }, { count: activeIntegrations }] =
    await Promise.all([
      supabase.from('website_leads').select('status, notification_status'),
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'waiting_client']),
      supabase.from('integration_health').select('*', { count: 'exact', head: true }).eq('api_status', 'active'),
    ]);

  const statusCounts: Record<string, number> = {};
  const notificationCounts = { sent: 0, pending: 0, failed: 0 };
  for (const row of leadRows ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    if (row.notification_status in notificationCounts) {
      notificationCounts[row.notification_status as keyof typeof notificationCounts] += 1;
    }
  }

  const totalLeads = leadRows?.length ?? 0;

  const cards = [
    { label: 'Total Leads', value: totalLeads },
    { label: 'New Leads', value: statusCounts.new ?? 0 },
    { label: 'Contacted', value: statusCounts.contacted ?? 0 },
    { label: 'In Discussion', value: statusCounts.in_discussion ?? 0 },
    { label: 'Proposal Sent', value: statusCounts.proposal_sent ?? 0 },
    { label: 'Offline Onboarding', value: statusCounts.offline_onboarding ?? 0 },
    { label: 'Active Clients', value: activeClients ?? 0 },
    { label: 'Open Support Tickets', value: openTickets ?? 0 },
    { label: 'Active Integrations', value: activeIntegrations ?? 0 },
    { label: 'Failed Notifications', value: notificationCounts.failed },
  ];

  const stageChartData = INQUIRY_STATUSES.map((s) => ({ label: s.label, value: statusCounts[s.value] ?? 0 }));

  const notificationChartData: Array<{ key: 'sent' | 'pending' | 'failed'; label: string; value: number }> = [
    { key: 'sent', label: 'Sent', value: notificationCounts.sent },
    { key: 'pending', label: 'Pending', value: notificationCounts.pending },
    { key: 'failed', label: 'Failed', value: notificationCounts.failed },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Overview</h1>
        <p className="text-sm text-[#707975] mt-1">BizLink Africa business snapshot.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(({ label, value }) => {
          const danger = CARD_ACCENT_DANGER.has(label) && value > 0;
          return (
            <div key={label} className={`bg-white border p-4 ${danger ? 'border-red-200' : 'border-[#bfc9c4]'}`}>
              <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider">{label}</p>
              <p className={`mt-1 font-[Geist,sans-serif] font-bold text-2xl ${danger ? 'text-red-700' : 'text-[#00342b]'}`}>
                {value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <LeadsByStageChart data={stageChartData} />
        <NotificationStatusChart data={notificationChartData} />
      </div>
    </div>
  );
}
