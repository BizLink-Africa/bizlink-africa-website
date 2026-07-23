import 'server-only';
import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CrossDepartmentMetric {
  key: string;
  label: string;
  department: string;
  value: number;
  permission: string;
  href: string;
}

// Cross-department Reports & Analytics: one headline count per department,
// each gated by that department's OWN view permission (not
// governance.analytics.view, which only gates the page itself) — a caller
// only ever sees metrics for modules they could already see on that
// module's own dashboard. Filtering happens in the caller (page/export
// route) against getUserPermissions(), so this function always computes
// every metric; nothing here decides who can see what.
export async function getCrossDepartmentMetrics(supabase: Supabase): Promise<CrossDepartmentMetric[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: overdueInvoices },
    { count: activeContracts },
    { count: activeCampaigns },
    { count: openTickets },
    { count: activeIncidents },
    { count: pendingComplianceReviews },
    { count: pendingApprovalActions },
  ] = await Promise.all([
    supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', ['issued', 'partially_paid', 'overdue']).lt('due_date', today).gt('outstanding_balance', 0),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('marketing_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['new', 'open', 'in_progress', 'waiting_client', 'waiting_internal', 'escalated', 'reopened']),
    supabase.from('technical_incidents').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    supabase.from('compliance_reviews').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_review']),
    supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return [
    { key: 'overdue_invoices', label: 'Overdue Invoices', department: 'Finance', value: overdueInvoices ?? 0, permission: 'invoices.view', href: '/admin/finance/invoices' },
    { key: 'active_contracts', label: 'Active Contracts', department: 'Operations', value: activeContracts ?? 0, permission: 'contracts.view', href: '/admin/contracts' },
    { key: 'active_campaigns', label: 'Active Campaigns', department: 'Marketing', value: activeCampaigns ?? 0, permission: 'campaigns.view', href: '/admin/marketing/campaigns' },
    { key: 'open_tickets', label: 'Open Tickets', department: 'Customer Support', value: openTickets ?? 0, permission: 'tickets.view', href: '/admin/support-tickets' },
    { key: 'active_incidents', label: 'Active Technical Incidents', department: 'Technology', value: activeIncidents ?? 0, permission: 'incidents.view', href: '/admin/technical-incidents' },
    { key: 'pending_compliance_reviews', label: 'Pending Compliance Reviews', department: 'Compliance & Security', value: pendingComplianceReviews ?? 0, permission: 'compliance.view', href: '/admin/compliance/reviews' },
    { key: 'pending_approval_actions', label: 'Pending Approval Actions', department: 'Governance', value: pendingApprovalActions ?? 0, permission: 'approval_workflows.view', href: '/admin/governance/approval-workflows' },
  ];
}
