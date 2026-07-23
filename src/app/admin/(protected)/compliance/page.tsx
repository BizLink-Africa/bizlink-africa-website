import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { getComplianceOverview } from '@/lib/dashboard/compliance-adapters';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function ComplianceDashboardPage() {
  try {
    await requirePermission('dashboard.compliance.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.compliance.view" />;
  }

  const supabase = await createClient();
  const overview = await getComplianceOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">Compliance Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load compliance data.</p>
      </div>
    );
  }

  const reviewKpis: Kpi[] = [
    { key: 'pending_reviews', label: 'Pending Compliance Reviews', value: overview.pendingReviewsCount, href: '/admin/compliance/reviews' },
    { key: 'completed_reviews', label: 'Completed Reviews', value: overview.completedReviewsCount, href: '/admin/compliance/reviews', accent: 'success' },
    { key: 'open_issues', label: 'Open Compliance Issues', value: overview.openComplianceIssuesCount, href: '/admin/compliance/reviews', accent: overview.openComplianceIssuesCount > 0 ? 'danger' : 'default' },
    { key: 'high_risk_findings', label: 'High-Risk Findings', value: overview.highRiskFindingsCount, href: '/admin/compliance/reviews', accent: overview.highRiskFindingsCount > 0 ? 'danger' : 'default' },
    { key: 'corrective_actions_overdue', label: 'Corrective Actions Overdue', value: overview.correctiveActionsOverdueCount, href: '/admin/compliance/reviews', accent: overview.correctiveActionsOverdueCount > 0 ? 'warning' : 'default' },
  ];

  const coverageKpis: Kpi[] = [
    { key: 'contracts_awaiting_review', label: 'Contracts Awaiting Compliance Review', value: overview.contractsAwaitingReviewCount, href: '/admin/compliance/contracts' },
    { key: 'clients_pending_compliance', label: 'Clients Pending Compliance', value: overview.clientsPendingComplianceCount, href: '/admin/compliance/clients' },
    { key: 'policies_awaiting_ack', label: 'Policies Awaiting Acknowledgement', value: overview.policiesAwaitingAcknowledgementCount, href: '/admin/compliance/policy-acknowledgements', accent: overview.policiesAwaitingAcknowledgementCount > 0 ? 'warning' : 'default' },
    { key: 'data_protection_deadlines', label: 'Data-Protection Deadlines (30d)', value: overview.dataProtectionDeadlinesCount, href: '/admin/compliance/data-protection', accent: overview.dataProtectionDeadlinesCount > 0 ? 'warning' : 'default' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Compliance Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">Compliance review status, coverage, and outstanding obligations across every client and contract.</p>
      </div>

      <KpiGrid title="Reviews & Findings" kpis={reviewKpis} />
      <KpiGrid title="Coverage & Obligations" kpis={coverageKpis} />
    </div>
  );
}
