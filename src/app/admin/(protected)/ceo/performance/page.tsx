import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import TrendLineChart from '@/components/admin/dashboard/TrendLineChart';
import BarListChart from '@/components/admin/dashboard/BarListChart';
import ModuleUnavailableCard from '@/components/admin/dashboard/ModuleUnavailableCard';
import { resolveDateRange } from '@/lib/dashboard/types';
import { CONTRACT_STATUSES } from '@/data/contracts';
import { getExecutiveActionItems } from '@/lib/dashboard/executive-adapters';
import {
  getClientsOverview,
  getLeadsOverview,
  getSupportOverview,
  getTechnicalOverview,
  getFinanceOverview,
  getContractsOverview,
  getMarketingOverview,
  INQUIRY_STATUSES,
  TICKET_STATUSES,
  API_STATUSES,
} from '@/lib/dashboard/ceo-adapters';

export const dynamic = 'force-dynamic';

export default async function CompanyPerformancePage() {
  try {
    await requirePermission('dashboard.ceo.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.ceo.view" />;
  }

  const supabase = await createClient();
  const { from: rangeFrom } = resolveDateRange('90d');

  const [clients, leads, support, technical, finance, contracts, marketing, actionItems] = await Promise.all([
    getClientsOverview(supabase, rangeFrom),
    getLeadsOverview(supabase, rangeFrom),
    getSupportOverview(supabase),
    getTechnicalOverview(supabase),
    getFinanceOverview(supabase),
    getContractsOverview(supabase),
    getMarketingOverview(supabase),
    getExecutiveActionItems(supabase),
  ]);

  const departmentCounts = new Map<string, number>();
  for (const item of actionItems) departmentCounts.set(item.department, (departmentCounts.get(item.department) ?? 0) + 1);
  const departmentChart = Array.from(departmentCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const leadStageChart = leads.available
    ? INQUIRY_STATUSES.map((s) => ({ label: s.label, value: leads.data.statusCounts[s.value] ?? 0 }))
    : [];
  const supportStatusChart = support.available
    ? TICKET_STATUSES.map((s) => ({ label: s.label, value: support.data.statusCounts[s.value] ?? 0 }))
    : [];
  const technicalStatusChart = technical.available
    ? API_STATUSES.map((s) => ({ label: s.label, value: technical.data.statusCounts[s.value] ?? 0 }))
    : [];
  const contractStatusChart = contracts.available
    ? CONTRACT_STATUSES.map((s) => ({ label: s.label, value: contracts.data.statusCounts[s.value] ?? 0 })).filter((s) => s.value > 0)
    : [];
  const marketingChannelChart = marketing.available
    ? marketing.data.byChannel.map((c) => ({ label: c.channel, value: c.count }))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/ceo" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to CEO Dashboard
        </Link>
        <h1 className="font-bold text-2xl text-[#00342b]">Company Performance</h1>
        <p className="text-sm text-[#707975] mt-1">
          Revenue, growth, and department-level performance, including breakdowns by department (folded in below rather
          than as a separate page — same underlying data).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {finance.available ? (
          <TrendLineChart title="Revenue Trend (6 months)" data={finance.data.revenueTrend} />
        ) : (
          <ModuleUnavailableCard title="Revenue Trend" reason={finance.reason} />
        )}
        {clients.available ? (
          <TrendLineChart title="Client Growth Trend (6 months)" data={clients.data.growthTrend} />
        ) : (
          <ModuleUnavailableCard title="Client Growth" reason={clients.reason} />
        )}
        {leads.available ? (
          <BarListChart title="Lead Conversion Funnel" data={leadStageChart} />
        ) : (
          <ModuleUnavailableCard title="Lead Conversion" reason={leads.reason} />
        )}
        <BarListChart title="Department Performance (open items)" data={departmentChart} />
        {contracts.available ? (
          <BarListChart title="Contract Performance (by status)" data={contractStatusChart} />
        ) : (
          <ModuleUnavailableCard title="Contract Performance" reason={contracts.reason} />
        )}
        {support.available ? (
          <BarListChart title="Support Performance (by status)" data={supportStatusChart} />
        ) : (
          <ModuleUnavailableCard title="Support Performance" reason={support.reason} />
        )}
        {technical.available ? (
          <BarListChart title="Technical Performance (by status)" data={technicalStatusChart} />
        ) : (
          <ModuleUnavailableCard title="Technical Performance" reason={technical.reason} />
        )}
        {marketing.available ? (
          <BarListChart title="Marketing Performance (by channel)" data={marketingChannelChart} />
        ) : (
          <ModuleUnavailableCard title="Marketing Performance" reason={marketing.reason} />
        )}
      </div>
    </div>
  );
}
