import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Crown, Users, Building2, LifeBuoy, Cpu, ShieldCheck, Wallet, Megaphone, ShieldAlert, Landmark } from 'lucide-react';

// Sidebar structure. Contains ONLY routes that exist today — modules not yet
// built are omitted entirely rather than shown as disabled/placeholder
// links, per explicit instruction. Add items here once each module ships.
export interface NavLeaf {
  label: string;
  href: string;
  permission: string | null;
  badgeKey?: BadgeKey;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavLeaf[];
}

export type BadgeKey =
  | 'actionQueue'
  | 'criticalTickets'
  | 'failedIntegrations'
  | 'overdueInvoices'
  | 'pendingApprovals'
  | 'pendingContracts'
  | 'openSecurityEvents'
  | 'pendingComplianceReviews'
  | 'failedNotifications'
  | 'failedWebhooks'
  | 'failedJobs'
  | 'activeIncidents'
  | 'pendingApprovalWorkflowActions';

export const TOP_LEVEL_LEAVES: { label: string; href: string; permission: string | null; icon: LucideIcon }[] = [
  { label: 'Overview', href: '/admin', permission: null, icon: LayoutDashboard },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Executive Management',
    icon: Crown,
    items: [
      { label: 'CEO Dashboard', href: '/admin/ceo', permission: 'dashboard.ceo.view', badgeKey: 'pendingApprovals' },
      { label: 'Executive Action Center', href: '/admin/ceo/actions', permission: 'executive.actions.view', badgeKey: 'actionQueue' },
      { label: 'Pending Approvals', href: '/admin/ceo/approvals', permission: 'executive.approvals.view' },
      { label: 'Company Performance', href: '/admin/ceo/performance', permission: 'dashboard.ceo.view' },
      { label: 'Executive Reports', href: '/admin/ceo/reports', permission: 'executive.reports.view' },
      { label: 'Company Alerts', href: '/admin/ceo/alerts', permission: 'executive.alerts.view' },
    ],
  },
  {
    label: 'CRM & Sales',
    icon: Users,
    items: [
      { label: 'CRM Dashboard', href: '/admin/crm', permission: 'dashboard.crm.view' },
      { label: 'Leads', href: '/admin/inquiries', permission: 'leads.view' },
      { label: 'Clients', href: '/admin/clients', permission: 'clients.view' },
      { label: 'Opportunities', href: '/admin/crm/opportunities', permission: 'opportunities.view' },
      { label: 'Solutions & Services', href: '/admin/services', permission: 'services.view' },
      { label: 'Proposals', href: '/admin/crm/proposals', permission: 'proposals.view' },
      { label: 'Sales Pipeline', href: '/admin/crm/pipeline', permission: 'dashboard.crm.view' },
      { label: 'Follow-ups', href: '/admin/crm/follow-ups', permission: 'crm.followups.view' },
      { label: 'Client Contacts', href: '/admin/crm/contacts', permission: 'clients.view' },
      { label: 'CRM Reports', href: '/admin/crm/reports', permission: 'crm.reports.view' },
    ],
  },
  {
    label: 'Operations',
    icon: Building2,
    items: [
      { label: 'Operations Dashboard', href: '/admin/operations', permission: 'dashboard.operations.view' },
      { label: 'Client Onboarding', href: '/admin/onboarding', permission: 'onboarding.view' },
      { label: 'Contracts', href: '/admin/contracts', permission: 'contracts.view', badgeKey: 'pendingContracts' },
      { label: 'Service Delivery', href: '/admin/service-delivery', permission: 'services.view' },
      { label: 'Projects', href: '/admin/operations/projects', permission: 'projects.view' },
      { label: 'Client Provisioning', href: '/admin/operations/provisioning', permission: 'provisioning.view' },
      { label: 'Operational Tasks', href: '/admin/operations/tasks', permission: 'operations.tasks.view' },
      { label: 'Resource Allocation', href: '/admin/operations/resources', permission: 'resources.view' },
      { label: 'Delivery Milestones', href: '/admin/operations/milestones', permission: 'projects.view' },
      { label: 'Operations Reports', href: '/admin/operations/reports', permission: 'operations.reports.view' },
    ],
  },
  {
    label: 'Finance',
    icon: Wallet,
    items: [
      { label: 'Financial Dashboard', href: '/admin/finance', permission: 'dashboard.finance.view' },
      { label: 'Proforma Invoices', href: '/admin/finance/proformas', permission: 'proformas.view' },
      { label: 'Invoices', href: '/admin/finance/invoices', permission: 'invoices.view', badgeKey: 'overdueInvoices' },
      { label: 'Payments Received', href: '/admin/finance/payments', permission: 'payments.view' },
      { label: 'Expenses', href: '/admin/finance/expenses', permission: 'expenses.view' },
      { label: 'Expense Approvals', href: '/admin/finance/expense-approvals', permission: 'expenses.approve' },
      { label: 'Receivables', href: '/admin/finance/receivables', permission: 'invoices.view' },
      { label: 'Revenue Management', href: '/admin/finance/revenue', permission: 'finance.reports.view' },
      { label: 'Tax Records', href: '/admin/finance/tax-records', permission: 'tax_records.view' },
      { label: 'Financial Forecasting', href: '/admin/finance/forecasting', permission: 'forecasting.view' },
      { label: 'Financial Reports', href: '/admin/finance/reports', permission: 'finance.reports.view' },
      { label: 'Finance Settings', href: '/admin/finance/settings', permission: 'finance.settings.view' },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { label: 'Marketing Dashboard', href: '/admin/marketing', permission: 'dashboard.marketing.view' },
      { label: 'Campaigns', href: '/admin/marketing/campaigns', permission: 'campaigns.view' },
      { label: 'Marketing Leads', href: '/admin/marketing/leads', permission: 'marketing_leads.view' },
      { label: 'Content Calendar', href: '/admin/marketing/content-calendar', permission: 'content_calendar.view' },
      { label: 'Social Media', href: '/admin/marketing/social', permission: 'social_media.view' },
      { label: 'Email Campaigns', href: '/admin/marketing/email-campaigns', permission: 'email_campaigns.view' },
      { label: 'Referral Campaigns', href: '/admin/marketing/referrals', permission: 'referrals.view' },
      { label: 'Partnership Campaigns', href: '/admin/marketing/partnerships', permission: 'referrals.view' },
      { label: 'Landing Pages', href: '/admin/marketing/landing-pages', permission: 'landing_pages.view' },
      { label: 'Campaign Analytics', href: '/admin/marketing/analytics', permission: 'marketing.analytics.view' },
      { label: 'Marketing Reports', href: '/admin/marketing/reports', permission: 'marketing.reports.view' },
    ],
  },
  {
    label: 'Customer Support',
    icon: LifeBuoy,
    items: [
      { label: 'Customer Support Dashboard', href: '/admin/support', permission: 'dashboard.support.view' },
      { label: 'Support Tickets', href: '/admin/support-tickets', permission: 'tickets.view', badgeKey: 'criticalTickets' },
      { label: 'Assigned Tickets', href: '/admin/support-tickets/assigned', permission: 'tickets.view' },
      { label: 'Unassigned Tickets', href: '/admin/support-tickets/unassigned', permission: 'tickets.view' },
      { label: 'Escalations', href: '/admin/support-tickets/escalations', permission: 'tickets.escalate' },
      { label: 'SLA Monitoring', href: '/admin/support/sla', permission: 'tickets.view' },
      { label: 'Customer Conversations', href: '/admin/support/conversations', permission: 'tickets.view' },
      { label: 'Knowledge Base', href: '/admin/support/knowledge-base', permission: 'knowledge_base.view' },
      { label: 'Customer Satisfaction', href: '/admin/support/satisfaction', permission: 'csat.view' },
      { label: 'Support Reports', href: '/admin/support/reports', permission: 'support.reports.view' },
      { label: 'Support Settings', href: '/admin/support/settings', permission: 'support.settings.view' },
    ],
  },
  {
    label: 'Technology',
    icon: Cpu,
    items: [
      { label: 'CTO Dashboard', href: '/admin/cto', permission: 'dashboard.technical.view' },
      { label: 'Integration Health', href: '/admin/integration-health', permission: 'integrations.view', badgeKey: 'failedIntegrations' },
      { label: 'AI Agents', href: '/admin/ai-agents', permission: 'ai_agents.view' },
      { label: 'API Monitoring', href: '/admin/api-monitoring', permission: 'api_logs.view' },
      { label: 'Webhook Monitoring', href: '/admin/webhook-monitoring', permission: 'webhooks.view', badgeKey: 'failedWebhooks' },
      { label: 'Deployment Management', href: '/admin/deployments', permission: 'deployments.view' },
      { label: 'Background Jobs', href: '/admin/background-jobs', permission: 'jobs.view', badgeKey: 'failedJobs' },
      { label: 'Technical Incidents', href: '/admin/technical-incidents', permission: 'incidents.view', badgeKey: 'activeIncidents' },
      { label: 'System Health', href: '/admin/system-health', permission: 'system.health.view' },
      { label: 'Database Health', href: '/admin/database-health', permission: 'database.health.view' },
      { label: 'Backup Monitoring', href: '/admin/backup-monitoring', permission: 'backups.view' },
      { label: 'Technical Reports', href: '/admin/technology/reports', permission: 'technology.reports.view' },
      { label: 'Technology Settings', href: '/admin/technology/settings', permission: 'technology.settings.view' },
    ],
  },
  {
    label: 'Compliance & Security',
    icon: ShieldAlert,
    items: [
      { label: 'Compliance Dashboard', href: '/admin/compliance', permission: 'dashboard.compliance.view' },
      { label: 'Compliance Reviews', href: '/admin/compliance/reviews', permission: 'compliance.view', badgeKey: 'pendingComplianceReviews' },
      { label: 'Client Compliance', href: '/admin/compliance/clients', permission: 'client_compliance.view' },
      { label: 'Contract Compliance', href: '/admin/compliance/contracts', permission: 'contract_compliance.view' },
      { label: 'Data Protection', href: '/admin/compliance/data-protection', permission: 'data_protection.view' },
      { label: 'Policies', href: '/admin/governance/policies', permission: 'policies.view' },
      { label: 'Policy Acknowledgements', href: '/admin/compliance/policy-acknowledgements', permission: 'policies.view' },
      { label: 'Access Reviews', href: '/admin/compliance/access-reviews', permission: 'access_reviews.view' },
      { label: 'Security Dashboard', href: '/admin/security', permission: 'dashboard.security.view' },
      { label: 'Security Events', href: '/admin/compliance/security-events', permission: 'security.view', badgeKey: 'openSecurityEvents' },
      { label: 'Security Incidents', href: '/admin/security/incidents', permission: 'security_incidents.view' },
      { label: 'Session Monitoring', href: '/admin/security/sessions', permission: 'sessions.view' },
      { label: 'Login Monitoring', href: '/admin/security/logins', permission: 'logins.view' },
      { label: 'Compliance Reports', href: '/admin/compliance/reports', permission: 'compliance.reports.view' },
      { label: 'Security Reports', href: '/admin/security/reports', permission: 'security.reports.view' },
    ],
  },
  {
    label: 'Governance',
    icon: Landmark,
    items: [
      { label: 'Governance Dashboard', href: '/admin/governance', permission: 'dashboard.governance.view' },
      { label: 'Roles & Permissions', href: '/admin/governance/roles', permission: 'roles.view' },
      { label: 'Policies', href: '/admin/governance/policies', permission: 'policies.view' },
      { label: 'Departments', href: '/admin/governance/departments', permission: 'departments.view' },
      { label: 'Approval Workflows', href: '/admin/governance/approval-workflows', permission: 'approval_workflows.view', badgeKey: 'pendingApprovalWorkflowActions' },
      { label: 'Staff Access Reviews', href: '/admin/compliance/access-reviews', permission: 'access_reviews.view' },
      { label: 'Reports & Analytics', href: '/admin/governance/analytics', permission: 'governance.analytics.view' },
      { label: 'Audit Summary', href: '/admin/governance/audit-summary', permission: 'governance.audit.view' },
      { label: 'Governance Reports', href: '/admin/governance/reports', permission: 'governance.reports.view' },
    ],
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      { label: 'Staff & Roles', href: '/admin/staff', permission: 'users.view' },
      { label: 'Audit Logs', href: '/admin/audit-logs', permission: 'audit.view' },
      { label: 'Notifications', href: '/admin/notifications', permission: 'notifications.view', badgeKey: 'failedNotifications' },
      { label: 'Company Settings', href: '/admin/settings/company', permission: 'company.settings.view' },
      { label: 'Finance Settings', href: '/admin/finance/settings', permission: 'finance.settings.view' },
      { label: 'Contract Settings', href: '/admin/settings/contracts', permission: 'contract.settings.view' },
      { label: 'Support Settings', href: '/admin/support/settings', permission: 'support.settings.view' },
      { label: 'Marketing Settings', href: '/admin/settings/marketing', permission: 'marketing.settings.view' },
      { label: 'Technology Settings', href: '/admin/technology/settings', permission: 'technology.settings.view' },
      { label: 'Compliance Settings', href: '/admin/settings/compliance', permission: 'compliance.settings.view' },
      { label: 'Security Settings', href: '/admin/settings/security', permission: 'security.settings.view' },
      { label: 'Email Settings', href: '/admin/settings/email', permission: 'email.settings.view' },
      { label: 'Notification Settings', href: '/admin/settings/notification-settings', permission: 'notification.settings.view' },
      { label: 'System Settings', href: '/admin/settings/system', permission: 'system.settings.view' },
      { label: 'Profile', href: '/admin/settings/profile', permission: null },
    ],
  },
];
