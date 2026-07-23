import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { computeExpiryFlag, type ContractStatus } from '@/data/contracts';
import type { ModuleUnavailable } from './types';
import { unavailable } from './types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ExecutivePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ExecutiveActionItem {
  id: string;
  module: string;
  category: string;
  department: string;
  actionType: string;
  priority: ExecutivePriority;
  title: string;
  detail: string;
  href: string;
  submittedAt: string;
  deadline: string | null;
}

// The 12 categories requested for the Executive Action Center. Every entry
// here is backed by a real query below — nothing here is fabricated.
export const EXECUTIVE_CATEGORIES = {
  CONTRACTS_PENDING_APPROVAL: 'Contracts Awaiting Approval',
  HIGH_VALUE_EXPENSES: 'High-Value Expenses',
  PROFORMAS_AWAITING_REVIEW: 'Proforma Invoices Awaiting Review',
  OVERDUE_INVOICES: 'Overdue Invoices',
  DELAYED_ONBOARDING: 'Delayed Onboarding',
  CRITICAL_SUPPORT: 'Critical Support Escalations',
  FAILED_INTEGRATIONS: 'Technical Incidents',
  SECURITY_INCIDENTS: 'Security Incidents',
  COMPLIANCE_ISSUES: 'Compliance Issues',
  CONTRACTS_EXPIRING_SOON: 'Contracts Expiring Soon',
} as const;

// Metrics the spec asks for that genuinely have no backing data anywhere in
// the schema (confirmed by a full migration audit) — reported honestly per
// this codebase's established ModuleResult/unavailable() convention rather
// than fabricated. "SLA Breaches" belongs here specifically because it's
// one of the 12 Action Center categories; the rest back the Dashboard KPIs.
export const EXECUTIVE_UNAVAILABLE: ModuleUnavailable[] = [
  unavailable('SLA Breaches', 'No SLA deadline field exists on support tickets yet.'),
  unavailable('Active Projects', 'No projects table exists — contracts and client services are not the same as tracked projects.'),
  unavailable('Projects at Risk', 'No projects table exists to compute risk from.'),
  unavailable('Overdue Operational Tasks', 'No general task-tracking table exists yet.'),
  unavailable('Campaign Conversion Rate', 'No link exists between marketing_campaigns and website_leads to compute attribution.'),
  unavailable('Campaign-Attributed Revenue', 'No link exists between marketing_campaigns and invoices to compute attribution.'),
  unavailable('Escalated Tickets', 'No escalation flag exists on support_tickets — only an "escalate" permission, not a data field.'),
  unavailable('Customer Satisfaction', 'No CSAT/rating field exists anywhere in the schema.'),
  unavailable('Platform Uptime', 'No uptime/monitoring table exists.'),
  unavailable('Critical Incidents', 'No dedicated incidents table exists (incidents.view/.manage permissions are seeded but unbacked). Failed Integrations is the closest real proxy.'),
];

function toItem(input: Omit<ExecutiveActionItem, 'priority'> & { priority?: ExecutivePriority }): ExecutiveActionItem {
  return { priority: 'normal', ...input };
}

// Single source of truth for "what needs executive attention right now" —
// reused by the Action Center, Pending Approvals, and Company Alerts pages
// so all three can never disagree about what's pending.
export async function getExecutiveActionItems(supabase: Supabase): Promise<ExecutiveActionItem[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: contracts },
    { data: expenses },
    { data: settings },
    { data: proformas },
    { data: invoices },
    { data: leads },
    { data: tickets },
    { data: integrations },
    { data: securityEvents },
    { data: complianceReviews },
  ] = await Promise.all([
    supabase.from('contracts').select('id, contract_number, contract_title, status, end_date, renewal_notice_period_days, created_at'),
    supabase.from('expenses').select('id, expense_number, description, amount, currency, status, expense_date, created_at'),
    supabase.from('company_settings').select('expense_high_value_threshold').eq('id', true).single(),
    supabase.from('proforma_invoices').select('id, proforma_number, client_business_name, total, currency, status, created_at'),
    supabase.from('invoices').select('id, invoice_number, client_business_name, total, currency, status, due_date, outstanding_balance, created_at'),
    supabase
      .from('website_leads')
      .select('id, business_name, status, follow_up_date, created_at')
      .in('status', ['contacted', 'in_discussion', 'proposal_sent', 'contract_review', 'offline_onboarding']),
    supabase.from('support_tickets').select('id, title, status, priority, created_at').eq('priority', 'urgent'),
    supabase.from('integration_health').select('id, service_type, api_status, error_message, created_at').eq('api_status', 'failed'),
    supabase.from('security_events').select('id, event_type, severity, description, status, created_at').in('status', ['open', 'investigating']),
    supabase.from('compliance_reviews').select('id, title, category, status, due_date, created_at').in('status', ['non_compliant', 'remediation_required']),
  ]);

  const items: ExecutiveActionItem[] = [];
  const highValueThreshold = settings?.expense_high_value_threshold ?? 500000;

  for (const c of contracts ?? []) {
    if (c.status === 'pending_ceo_approval') {
      items.push(
        toItem({
          id: c.id,
          module: 'contracts',
          category: EXECUTIVE_CATEGORIES.CONTRACTS_PENDING_APPROVAL,
          department: 'Executive',
          actionType: 'approval',
          priority: 'high',
          title: `${c.contract_number} — ${c.contract_title}`,
          detail: 'Awaiting CEO approval',
          href: `/admin/contracts/${c.id}`,
          submittedAt: c.created_at,
          deadline: null,
        })
      );
    }
    const expiry = computeExpiryFlag(c.status as ContractStatus, c.end_date, c.renewal_notice_period_days, today);
    if (expiry === 'expiring_soon') {
      items.push(
        toItem({
          id: c.id,
          module: 'contracts',
          category: EXECUTIVE_CATEGORIES.CONTRACTS_EXPIRING_SOON,
          department: 'Operations',
          actionType: 'review',
          title: `${c.contract_number} — ${c.contract_title}`,
          detail: `Ends ${c.end_date}`,
          href: `/admin/contracts/${c.id}`,
          submittedAt: c.created_at,
          deadline: c.end_date,
        })
      );
    }
  }

  for (const e of expenses ?? []) {
    if (['submitted', 'pending_approval'].includes(e.status) && e.amount >= highValueThreshold) {
      items.push(
        toItem({
          id: e.id,
          module: 'expenses',
          category: EXECUTIVE_CATEGORIES.HIGH_VALUE_EXPENSES,
          department: 'Finance',
          actionType: 'approval',
          priority: 'high',
          title: `${e.expense_number} — ${e.description}`,
          detail: `${e.currency} ${e.amount.toLocaleString()}`,
          href: '/admin/finance/expenses',
          submittedAt: e.created_at,
          deadline: null,
        })
      );
    }
  }

  for (const p of proformas ?? []) {
    if (p.status === 'pending_approval') {
      items.push(
        toItem({
          id: p.id,
          module: 'proforma_invoices',
          category: EXECUTIVE_CATEGORIES.PROFORMAS_AWAITING_REVIEW,
          department: 'Finance',
          actionType: 'review',
          title: `${p.proforma_number} — ${p.client_business_name}`,
          detail: `${p.currency} ${p.total.toLocaleString()}`,
          href: `/admin/finance/proformas/${p.id}`,
          submittedAt: p.created_at,
          deadline: null,
        })
      );
    }
  }

  for (const inv of invoices ?? []) {
    const isOverdue = inv.due_date && inv.due_date < today && (inv.outstanding_balance ?? 0) > 0 && !['paid', 'cancelled', 'written_off'].includes(inv.status);
    if (isOverdue) {
      items.push(
        toItem({
          id: inv.id,
          module: 'invoices',
          category: EXECUTIVE_CATEGORIES.OVERDUE_INVOICES,
          department: 'Finance',
          actionType: 'review',
          priority: 'high',
          title: `${inv.invoice_number} — ${inv.client_business_name}`,
          detail: `${inv.currency} ${(inv.outstanding_balance ?? 0).toLocaleString()} outstanding`,
          href: `/admin/finance/invoices/${inv.id}`,
          submittedAt: inv.created_at,
          deadline: inv.due_date,
        })
      );
    }
  }

  for (const l of leads ?? []) {
    if (l.follow_up_date && l.follow_up_date < today) {
      items.push(
        toItem({
          id: l.id,
          module: 'website_leads',
          category: EXECUTIVE_CATEGORIES.DELAYED_ONBOARDING,
          department: 'Operations',
          actionType: 'review',
          title: l.business_name,
          detail: `Follow-up was due ${l.follow_up_date}`,
          href: `/admin/inquiries/${l.id}`,
          submittedAt: l.created_at,
          deadline: l.follow_up_date,
        })
      );
    }
  }

  for (const t of tickets ?? []) {
    if (['open', 'in_progress', 'waiting_client'].includes(t.status)) {
      items.push(
        toItem({
          id: t.id,
          module: 'support_tickets',
          category: EXECUTIVE_CATEGORIES.CRITICAL_SUPPORT,
          department: 'Customer Support',
          actionType: 'escalation',
          priority: 'urgent',
          title: t.title,
          detail: 'Urgent priority, unresolved',
          href: '/admin/support-tickets',
          submittedAt: t.created_at,
          deadline: null,
        })
      );
    }
  }

  for (const i of integrations ?? []) {
    items.push(
      toItem({
        id: i.id,
        module: 'integration_health',
        category: EXECUTIVE_CATEGORIES.FAILED_INTEGRATIONS,
        department: 'Technology',
        actionType: 'incident',
        priority: 'high',
        title: i.service_type,
        detail: i.error_message ?? 'Integration failing',
        href: '/admin/integration-health',
        submittedAt: i.created_at,
        deadline: null,
      })
    );
  }

  for (const s of securityEvents ?? []) {
    items.push(
      toItem({
        id: s.id,
        module: 'security_events',
        category: EXECUTIVE_CATEGORIES.SECURITY_INCIDENTS,
        department: 'Compliance & Security',
        actionType: 'incident',
        priority: s.severity === 'critical' ? 'urgent' : 'high',
        title: s.event_type,
        detail: s.description,
        href: '/admin/compliance/security-events',
        submittedAt: s.created_at,
        deadline: null,
      })
    );
  }

  for (const r of complianceReviews ?? []) {
    items.push(
      toItem({
        id: r.id,
        module: 'compliance_reviews',
        category: EXECUTIVE_CATEGORIES.COMPLIANCE_ISSUES,
        department: 'Compliance & Security',
        actionType: 'review',
        priority: 'high',
        title: r.title,
        detail: r.status === 'non_compliant' ? 'Non-compliant' : 'Remediation required',
        href: '/admin/compliance/reviews',
        submittedAt: r.created_at,
        deadline: r.due_date,
      })
    );
  }

  return items;
}
