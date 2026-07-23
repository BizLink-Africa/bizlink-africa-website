import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { getGovernanceOverview } from '@/lib/dashboard/governance-adapters';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function GovernanceDashboardPage() {
  try {
    await requirePermission('dashboard.governance.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.governance.view" />;
  }

  const supabase = await createClient();
  const overview = await getGovernanceOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-4">Governance Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load governance data.
        </p>
      </div>
    );
  }

  const workforceKpis: Kpi[] = [
    { key: 'total_staff', label: 'Total Staff', value: overview.totalStaffCount, href: '/admin/staff' },
    { key: 'active_roles', label: 'Active Roles', value: overview.activeRolesCount, href: '/admin/governance/roles' },
    { key: 'custom_roles', label: 'Custom Roles', value: overview.customRolesCount, href: '/admin/governance/roles' },
    { key: 'recent_permission_changes', label: 'Recent Permission Changes (30d)', value: overview.recentPermissionChangesCount, href: '/admin/governance/audit-summary' },
  ];

  const riskKpis: Kpi[] = [
    { key: 'pending_access_reviews', label: 'Pending Access Reviews', value: overview.pendingAccessReviewsCount, href: '/admin/compliance/access-reviews', accent: overview.pendingAccessReviewsCount > 0 ? 'warning' : 'default' },
    { key: 'pending_policy_ack', label: 'Pending Policy Acknowledgements', value: overview.pendingPolicyAcknowledgementsCount, href: '/admin/compliance/policy-acknowledgements', accent: overview.pendingPolicyAcknowledgementsCount > 0 ? 'warning' : 'default' },
    { key: 'open_governance_issues', label: 'Open Governance Issues', value: overview.openGovernanceIssuesCount, href: '/admin/governance/audit-summary', accent: overview.openGovernanceIssuesCount > 0 ? 'danger' : 'default' },
    { key: 'pending_approval_actions', label: 'Pending Approval Workflow Actions', value: overview.pendingApprovalWorkflowActionsCount, href: '/admin/governance/approval-workflows', accent: overview.pendingApprovalWorkflowActionsCount > 0 ? 'warning' : 'default' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Governance Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">
          Staff, roles, policies, and approvals across the whole platform — built from live tables.
        </p>
      </div>

      <KpiGrid title="Workforce & Roles" kpis={workforceKpis} />
      <KpiGrid title="Risk & Pending Action" kpis={riskKpis} />
    </div>
  );
}
