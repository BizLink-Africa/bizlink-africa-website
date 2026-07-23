import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { CLOSED_ONBOARDING_STAGES } from '@/data/operations';
import { computeExpiryFlag, type ContractStatus } from '@/data/contracts';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface OperationsOverview {
  newOnboardingCasesCount: number;
  pendingOnboardingCount: number;
  documentsPendingCount: number;
  complianceReviewsPendingCount: number;
  contractsAwaitingPreparationCount: number;
  contractsAwaitingApprovalCount: number;
  contractsAwaitingSignatureCount: number;
  projectsInProgressCount: number;
  projectsDelayedCount: number;
  clientsAwaitingProvisioningCount: number;
  servicesAwaitingActivationCount: number;
  blockedOperationalTasksCount: number;
  overdueTasksCount: number;
  completedDeliveriesCount: number;
  averageOnboardingTimeDays: number | null;
  contractsExpiringSoonCount: number;
}

const CONTRACTS_AWAITING_PREPARATION: ContractStatus[] = ['draft', 'under_review'];
const CONTRACTS_AWAITING_APPROVAL: ContractStatus[] = ['pending_compliance_review', 'pending_ceo_approval'];
const CONTRACTS_AWAITING_SIGNATURE: ContractStatus[] = ['sent_to_client', 'awaiting_signature'];

export async function getOperationsOverview(supabase: Supabase): Promise<OperationsOverview | null> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const [
    { data: onboardingCases, error: e1 },
    { data: contracts, error: e2 },
    { data: projects, error: e3 },
    { data: provisioning, error: e4 },
    { data: clientServices, error: e5 },
    { data: tasks, error: e6 },
  ] = await Promise.all([
    supabase.from('onboarding_cases').select('stage, created_at, updated_at'),
    supabase.from('contracts').select('status, end_date, renewal_notice_period_days'),
    supabase.from('projects').select('status'),
    supabase.from('client_provisioning').select('handover_status'),
    supabase.from('client_services').select('status, delivery_status'),
    supabase.from('operational_tasks').select('status, due_date'),
  ]);

  if (e1 || e2 || e3 || e4 || e5 || e6 || !onboardingCases || !contracts || !projects || !provisioning || !clientServices || !tasks) {
    return null;
  }

  const activatedCases = onboardingCases.filter((c) => c.stage === 'activated');
  const onboardingDurations = activatedCases.map(
    (c) => (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const averageOnboardingTimeDays =
    onboardingDurations.length > 0
      ? Math.round((onboardingDurations.reduce((s, d) => s + d, 0) / onboardingDurations.length) * 10) / 10
      : null;

  const contractsExpiringSoonCount = contracts.filter(
    (c) => computeExpiryFlag(c.status as ContractStatus, c.end_date, c.renewal_notice_period_days, todayStr) === 'expiring_soon'
  ).length;

  return {
    newOnboardingCasesCount: onboardingCases.filter((c) => c.created_at >= monthStart).length,
    pendingOnboardingCount: onboardingCases.filter((c) => !CLOSED_ONBOARDING_STAGES.includes(c.stage)).length,
    documentsPendingCount: onboardingCases.filter((c) => c.stage === 'documents_pending').length,
    complianceReviewsPendingCount: onboardingCases.filter((c) => c.stage === 'compliance_review').length,
    contractsAwaitingPreparationCount: contracts.filter((c) => CONTRACTS_AWAITING_PREPARATION.includes(c.status as ContractStatus)).length,
    contractsAwaitingApprovalCount: contracts.filter((c) => CONTRACTS_AWAITING_APPROVAL.includes(c.status as ContractStatus)).length,
    contractsAwaitingSignatureCount: contracts.filter((c) => CONTRACTS_AWAITING_SIGNATURE.includes(c.status as ContractStatus)).length,
    projectsInProgressCount: projects.filter((p) => p.status === 'in_progress').length,
    projectsDelayedCount: projects.filter((p) => p.status === 'delayed').length,
    clientsAwaitingProvisioningCount: provisioning.filter((p) => p.handover_status !== 'completed').length,
    servicesAwaitingActivationCount: clientServices.filter((s) => s.status === 'pending').length,
    blockedOperationalTasksCount: tasks.filter((t) => t.status === 'blocked').length,
    overdueTasksCount: tasks.filter((t) => t.due_date && t.due_date < todayStr && !['completed', 'cancelled'].includes(t.status)).length,
    completedDeliveriesCount: clientServices.filter((s) => s.delivery_status === 'delivered').length,
    averageOnboardingTimeDays,
    contractsExpiringSoonCount,
  };
}
