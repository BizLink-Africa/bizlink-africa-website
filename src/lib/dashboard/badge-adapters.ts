import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import type { BadgeKey } from '@/data/navigation';

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Sidebar badge counts — deliberately cheap: count-only queries (head:
// true, no row bodies fetched), not a reuse of the full dashboard adapters.
// Failures degrade to 0 rather than breaking the sidebar.
export async function getSidebarBadgeCounts(supabase: Supabase): Promise<Record<BadgeKey, number>> {
  const today = new Date().toISOString().slice(0, 10);
  const inProgressStatuses = ['contacted', 'in_discussion', 'proposal_sent', 'contract_review', 'offline_onboarding'];
  const openTicketStatuses = ['new', 'open', 'in_progress', 'waiting_client', 'waiting_internal', 'escalated', 'reopened'];
  // Contract stages still owned by Operations, before it reaches either
  // approval gate — kept distinct from pendingApprovals/pendingComplianceReviews
  // below so each group's badge reflects work that group actually owns.
  const operationalContractStatuses = ['draft', 'under_review', 'sent_to_client', 'awaiting_signature'];
  const openSecurityEventStatuses = ['open', 'investigating'];
  const pendingComplianceReviewStatuses = ['pending', 'in_review'];

  const [
    delayedOnboarding,
    criticalTickets,
    failedIntegrations,
    overdueInvoices,
    pendingApprovals,
    pendingContracts,
    openSecurityEvents,
    pendingComplianceReviews,
    failedNotifications,
    failedWebhooks,
    failedJobs,
    activeIncidents,
    pendingApprovalWorkflowActions,
  ] = await Promise.all([
    supabase
      .from('website_leads')
      .select('id', { count: 'exact', head: true })
      .in('status', inProgressStatuses)
      .lt('follow_up_date', today),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'urgent')
      .in('status', openTicketStatuses),
    supabase
      .from('integration_health')
      .select('id', { count: 'exact', head: true })
      .eq('api_status', 'failed'),
    // Every query below is safe to call even before its migration runs — a
    // missing table comes back as a query error, not a thrown exception, and
    // .count is simply null in that case (handled by the ?? 0 fallbacks).
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['issued', 'partially_paid', 'overdue'])
      .lt('due_date', today)
      .gt('outstanding_balance', 0),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'pending_ceo_approval'),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).in('status', operationalContractStatuses),
    supabase.from('security_events').select('id', { count: 'exact', head: true }).in('status', openSecurityEventStatuses),
    supabase.from('compliance_reviews').select('id', { count: 'exact', head: true }).in('status', pendingComplianceReviewStatuses),
    supabase.from('website_leads').select('id', { count: 'exact', head: true }).eq('notification_status', 'failed'),
    supabase.from('webhook_deliveries').select('id', { count: 'exact', head: true }).eq('delivery_status', 'failed'),
    supabase.from('background_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('technical_incidents').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const criticalTicketsCount = criticalTickets.count ?? 0;
  const failedIntegrationsCount = failedIntegrations.count ?? 0;
  const delayedOnboardingCount = delayedOnboarding.count ?? 0;
  const overdueInvoicesCount = overdueInvoices.count ?? 0;

  return {
    criticalTickets: criticalTicketsCount,
    failedIntegrations: failedIntegrationsCount,
    overdueInvoices: overdueInvoicesCount,
    actionQueue: delayedOnboardingCount + criticalTicketsCount + failedIntegrationsCount,
    pendingApprovals: pendingApprovals.count ?? 0,
    pendingContracts: pendingContracts.count ?? 0,
    openSecurityEvents: openSecurityEvents.count ?? 0,
    pendingComplianceReviews: pendingComplianceReviews.count ?? 0,
    failedNotifications: failedNotifications.count ?? 0,
    failedWebhooks: failedWebhooks.count ?? 0,
    failedJobs: failedJobs.count ?? 0,
    activeIncidents: activeIncidents.count ?? 0,
    pendingApprovalWorkflowActions: pendingApprovalWorkflowActions.count ?? 0,
  };
}
