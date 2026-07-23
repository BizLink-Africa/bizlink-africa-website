import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import BarListChart from '@/components/admin/dashboard/BarListChart';
import { getSupportOverview } from '@/lib/dashboard/support-adapters';
import { TICKET_CATEGORIES, labelFor } from '@/data/tickets';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function SupportDashboardPage() {
  try {
    await requirePermission('dashboard.support.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.support.view" />;
  }

  const supabase = await createClient();
  const overview = await getSupportOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">Customer Support Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load support data.</p>
      </div>
    );
  }

  const [{ data: clients }, { data: staffRows }] = await Promise.all([
    supabase.from('clients').select('id, business_name').in('id', overview.byClient.map((c) => c.clientId)),
    supabase.from('staff_profiles').select('id, full_name').in('id', overview.byAgent.map((a) => a.agentId)),
  ]);
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.business_name]));
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  const ticketKpis: Kpi[] = [
    { key: 'open_tickets', label: 'Open Tickets', value: overview.openTicketsCount, href: '/admin/support-tickets' },
    { key: 'pending_tickets', label: 'Pending Tickets', value: overview.pendingTicketsCount, href: '/admin/support-tickets' },
    { key: 'assigned_tickets', label: 'Assigned Tickets', value: overview.assignedTicketsCount, href: '/admin/support-tickets/assigned' },
    { key: 'unassigned_tickets', label: 'Unassigned Tickets', value: overview.unassignedTicketsCount, href: '/admin/support-tickets/unassigned', accent: overview.unassignedTicketsCount > 0 ? 'warning' : 'default' },
    { key: 'resolved_tickets', label: 'Resolved Tickets', value: overview.resolvedTicketsCount, accent: 'success' },
    { key: 'escalated_tickets', label: 'Escalated Tickets', value: overview.escalatedTicketsCount, href: '/admin/support-tickets/escalations' },
    { key: 'critical_tickets', label: 'Critical Tickets', value: overview.criticalTicketsCount, accent: overview.criticalTicketsCount > 0 ? 'danger' : 'default' },
    { key: 'reopened_tickets', label: 'Reopened Tickets', value: overview.reopenedTicketsCount },
  ];

  const slaKpis: Kpi[] = [
    { key: 'sla_breaches', label: 'SLA Breaches', value: overview.slaBreachesCount, href: '/admin/support/sla', accent: overview.slaBreachesCount > 0 ? 'danger' : 'default' },
    { key: 'avg_first_response', label: 'Avg. First-Response Time', value: overview.avgFirstResponseHours !== null ? `${overview.avgFirstResponseHours}h` : '—' },
    { key: 'avg_resolution', label: 'Avg. Resolution Time', value: overview.avgResolutionHours !== null ? `${overview.avgResolutionHours}h` : '—' },
    { key: 'csat', label: 'Customer Satisfaction', value: overview.csatAverage !== null ? `${overview.csatAverage} / 5` : '—', href: '/admin/support/satisfaction' },
  ];

  const byClientChart = overview.byClient.map((c) => ({ label: clientNameById.get(c.clientId) ?? 'Unknown', value: c.count }));
  const byCategoryChart = overview.byCategory.map((c) => ({ label: labelFor(TICKET_CATEGORIES, c.category), value: c.count }));
  const byAgentChart = overview.byAgent.map((a) => ({ label: staffNameById.get(a.agentId) ?? 'Unknown', value: a.count }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Customer Support Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">Ticket health, SLA compliance, and customer satisfaction across every client.</p>
      </div>

      <KpiGrid title="Tickets" kpis={ticketKpis} />
      <KpiGrid title="SLA & Satisfaction" kpis={slaKpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BarListChart title="Tickets by Client" data={byClientChart} />
        <BarListChart title="Tickets by Category" data={byCategoryChart} />
        <BarListChart title="Tickets by Agent" data={byAgentChart} />
      </div>
    </div>
  );
}
