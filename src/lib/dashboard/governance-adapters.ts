import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface GovernanceOverview {
  totalStaffCount: number;
  activeRolesCount: number;
  customRolesCount: number;
  pendingAccessReviewsCount: number;
  recentPermissionChangesCount: number;
  pendingPolicyAcknowledgementsCount: number;
  openGovernanceIssuesCount: number;
  pendingApprovalWorkflowActionsCount: number;
}

// Every number is derived from live tables, same discipline as
// cto-adapters.ts/compliance-adapters.ts — nothing here is fabricated.
export async function getGovernanceOverview(supabase: Supabase): Promise<GovernanceOverview | null> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: staffRows, error: e1 },
    { data: roleRows, error: e2 },
    { data: accessReviews, error: e3 },
    { data: permissionChanges, error: e4 },
    { data: policyRows, error: e5 },
    { data: acknowledgements, error: e6 },
    { data: approvalRequests, error: e7 },
  ] = await Promise.all([
    supabase.from('staff_profiles').select('id').eq('is_active', true),
    supabase.from('roles').select('id, is_system, is_active'),
    supabase.from('access_reviews').select('decision, excessive_access_flag'),
    supabase.from('audit_logs').select('id').eq('module', 'role_permissions').gte('created_at', thirtyDaysAgo),
    supabase.from('governance_policies').select('id, status, review_date, acknowledgement_required'),
    supabase.from('policy_acknowledgements').select('policy_id, staff_id'),
    supabase.from('approval_requests').select('status'),
  ]);

  if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || !staffRows || !roleRows || !accessReviews || !permissionChanges || !policyRows || !acknowledgements || !approvalRequests) {
    return null;
  }

  const activeStaffIds = new Set(staffRows.map((s) => s.id));
  const acknowledgedByPolicy = new Map<string, Set<string>>();
  for (const a of acknowledgements) {
    if (!acknowledgedByPolicy.has(a.policy_id)) acknowledgedByPolicy.set(a.policy_id, new Set());
    acknowledgedByPolicy.get(a.policy_id)!.add(a.staff_id);
  }
  const policiesRequiringAck = policyRows.filter((p) => p.acknowledgement_required);
  const pendingPolicyAcknowledgementsCount = policiesRequiringAck.filter((p) => {
    const acked = acknowledgedByPolicy.get(p.id) ?? new Set();
    return [...activeStaffIds].some((id) => !acked.has(id));
  }).length;

  const overduePolicyReviewsCount = policyRows.filter((p) => p.status === 'active' && p.review_date && p.review_date < todayStr).length;
  const flaggedPendingAccessReviewsCount = accessReviews.filter((r) => r.excessive_access_flag && r.decision === 'pending').length;

  return {
    totalStaffCount: activeStaffIds.size,
    activeRolesCount: roleRows.filter((r) => r.is_active).length,
    customRolesCount: roleRows.filter((r) => !r.is_system).length,
    pendingAccessReviewsCount: accessReviews.filter((r) => r.decision === 'pending').length,
    recentPermissionChangesCount: permissionChanges.length,
    pendingPolicyAcknowledgementsCount,
    openGovernanceIssuesCount: overduePolicyReviewsCount + flaggedPendingAccessReviewsCount,
    pendingApprovalWorkflowActionsCount: approvalRequests.filter((r) => r.status === 'pending').length,
  };
}
