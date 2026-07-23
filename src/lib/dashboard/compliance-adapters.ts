import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ComplianceOverview {
  pendingReviewsCount: number;
  completedReviewsCount: number;
  openComplianceIssuesCount: number;
  highRiskFindingsCount: number;
  correctiveActionsOverdueCount: number;
  contractsAwaitingReviewCount: number;
  clientsPendingComplianceCount: number;
  policiesAwaitingAcknowledgementCount: number;
  dataProtectionDeadlinesCount: number;
}

// Compliance Dashboard KPIs only — Security Dashboard (failed logins,
// sessions, security incidents, etc.) lives in security-adapters.ts as its
// own page, per spec these are two distinct dashboards, not one merged view.
export async function getComplianceOverview(supabase: Supabase): Promise<ComplianceOverview | null> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { data: reviews, error: e1 },
    { data: contracts, error: e2 },
    { data: clientRows, error: e3 },
    { data: policyRows, error: e4 },
    { data: acknowledgements, error: e5 },
    { data: staffRows, error: e6 },
    { data: dataProtection, error: e7 },
  ] = await Promise.all([
    supabase.from('compliance_reviews').select('status, risk_level, completed_date, corrective_action_due_date'),
    supabase.from('contract_compliance').select('review_status'),
    supabase.from('client_compliance').select('compliance_status'),
    supabase.from('governance_policies').select('id, acknowledgement_required').eq('acknowledgement_required', true),
    supabase.from('policy_acknowledgements').select('policy_id, staff_id'),
    supabase.from('staff_profiles').select('id').eq('is_active', true),
    supabase.from('data_protection_activities').select('review_date'),
  ]);

  if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || !reviews || !contracts || !clientRows || !policyRows || !acknowledgements || !staffRows || !dataProtection) {
    return null;
  }

  const activeStaffIds = new Set(staffRows.map((s) => s.id));
  const acknowledgedByPolicy = new Map<string, Set<string>>();
  for (const a of acknowledgements) {
    if (!acknowledgedByPolicy.has(a.policy_id)) acknowledgedByPolicy.set(a.policy_id, new Set());
    acknowledgedByPolicy.get(a.policy_id)!.add(a.staff_id);
  }
  const policiesAwaitingAcknowledgementCount = policyRows.filter((p) => {
    const acked = acknowledgedByPolicy.get(p.id) ?? new Set();
    return [...activeStaffIds].some((id) => !acked.has(id));
  }).length;

  return {
    pendingReviewsCount: reviews.filter((r) => r.status === 'pending' || r.status === 'in_review').length,
    completedReviewsCount: reviews.filter((r) => r.completed_date !== null).length,
    openComplianceIssuesCount: reviews.filter((r) => r.status === 'non_compliant' || r.status === 'remediation_required').length,
    highRiskFindingsCount: reviews.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length,
    correctiveActionsOverdueCount: reviews.filter(
      (r) => r.corrective_action_due_date && r.corrective_action_due_date < todayStr && r.status !== 'compliant'
    ).length,
    contractsAwaitingReviewCount: contracts.filter((c) => c.review_status === 'pending' || c.review_status === 'in_review').length,
    clientsPendingComplianceCount: clientRows.filter((c) => c.compliance_status === 'pending' || c.compliance_status === 'under_review').length,
    policiesAwaitingAcknowledgementCount,
    dataProtectionDeadlinesCount: dataProtection.filter((d) => d.review_date && d.review_date <= thirtyDaysOut).length,
  };
}
