import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import KpiGrid from '@/components/admin/dashboard/KpiGrid';
import { getOperationsOverview } from '@/lib/dashboard/operations-adapters';
import type { Kpi } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function OperationsDashboardPage() {
  try {
    await requirePermission('dashboard.operations.view');
  } catch {
    return <AccessDenied requiredPermission="dashboard.operations.view" />;
  }

  const supabase = await createClient();
  const overview = await getOperationsOverview(supabase);

  if (!overview) {
    return (
      <div>
        <h1 className="font-bold text-2xl text-[#00342b] mb-2">Operations Dashboard</h1>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load operations data.</p>
      </div>
    );
  }

  const onboardingKpis: Kpi[] = [
    { key: 'new_onboarding_cases', label: 'New Onboarding Cases', value: overview.newOnboardingCasesCount, href: '/admin/onboarding/pipeline' },
    { key: 'pending_onboarding', label: 'Pending Onboarding', value: overview.pendingOnboardingCount, href: '/admin/onboarding/pipeline' },
    { key: 'documents_pending', label: 'Documents Pending', value: overview.documentsPendingCount, href: '/admin/onboarding/pipeline', accent: overview.documentsPendingCount > 0 ? 'warning' : 'default' },
    { key: 'compliance_reviews_pending', label: 'Compliance Reviews Pending', value: overview.complianceReviewsPendingCount, href: '/admin/onboarding/pipeline', accent: overview.complianceReviewsPendingCount > 0 ? 'warning' : 'default' },
    { key: 'average_onboarding_time', label: 'Average Onboarding Time', value: overview.averageOnboardingTimeDays !== null ? `${overview.averageOnboardingTimeDays} days` : '—' },
  ];

  const contractKpis: Kpi[] = [
    { key: 'contracts_awaiting_preparation', label: 'Contracts Awaiting Preparation', value: overview.contractsAwaitingPreparationCount, href: '/admin/contracts' },
    { key: 'contracts_awaiting_approval', label: 'Contracts Awaiting Approval', value: overview.contractsAwaitingApprovalCount, href: '/admin/contracts', accent: overview.contractsAwaitingApprovalCount > 0 ? 'warning' : 'default' },
    { key: 'contracts_awaiting_signature', label: 'Contracts Awaiting Signature', value: overview.contractsAwaitingSignatureCount, href: '/admin/contracts' },
    { key: 'contracts_expiring_soon', label: 'Contracts Expiring Soon', value: overview.contractsExpiringSoonCount, href: '/admin/contracts', accent: overview.contractsExpiringSoonCount > 0 ? 'danger' : 'default' },
  ];

  const deliveryKpis: Kpi[] = [
    { key: 'projects_in_progress', label: 'Projects In Progress', value: overview.projectsInProgressCount, href: '/admin/operations/projects' },
    { key: 'projects_delayed', label: 'Projects Delayed', value: overview.projectsDelayedCount, href: '/admin/operations/projects', accent: overview.projectsDelayedCount > 0 ? 'danger' : 'default' },
    { key: 'clients_awaiting_provisioning', label: 'Clients Awaiting Provisioning', value: overview.clientsAwaitingProvisioningCount, href: '/admin/operations/provisioning' },
    { key: 'services_awaiting_activation', label: 'Services Awaiting Activation', value: overview.servicesAwaitingActivationCount, href: '/admin/service-delivery' },
    { key: 'completed_deliveries', label: 'Completed Deliveries', value: overview.completedDeliveriesCount, href: '/admin/service-delivery', accent: 'success' },
  ];

  const taskKpis: Kpi[] = [
    { key: 'blocked_tasks', label: 'Blocked Operational Tasks', value: overview.blockedOperationalTasksCount, href: '/admin/operations/tasks', accent: overview.blockedOperationalTasksCount > 0 ? 'danger' : 'default' },
    { key: 'overdue_tasks', label: 'Overdue Tasks', value: overview.overdueTasksCount, href: '/admin/operations/tasks', accent: overview.overdueTasksCount > 0 ? 'danger' : 'default' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Operations Dashboard</h1>
        <p className="text-sm text-[#707975] mt-1">
          Onboarding, contracts, delivery, and operational task health across every active client engagement.
        </p>
      </div>

      <KpiGrid title="Onboarding" kpis={onboardingKpis} />
      <KpiGrid title="Contracts" kpis={contractKpis} />
      <KpiGrid title="Projects & Delivery" kpis={deliveryKpis} />
      <KpiGrid title="Tasks" kpis={taskKpis} />
    </div>
  );
}
