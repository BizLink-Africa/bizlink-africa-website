import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { INQUIRY_STATUSES } from '@/data/inquiries';
import { API_STATUSES } from '@/data/integrations';
import { TICKET_STATUSES } from '@/data/tickets';
import { type ModuleResult, type TrendPoint, type ActionItem, unavailable } from './types';
import { getFinanceOverview as realGetFinanceOverview, type FinanceOverview as RealFinanceOverview } from './finance-adapters';
import { getContractsOverview as realGetContractsOverview, type ContractsOverview as RealContractsOverview } from './contracts-adapters';
import { getComplianceOverview as realGetComplianceOverview, type ComplianceOverview as RealComplianceOverview } from './compliance-adapters';
import { getSecurityOverview as realGetSecurityOverview, type SecurityOverview as RealSecurityOverview } from './security-adapters';
import { getMarketingOverview as realGetMarketingOverview, type MarketingOverview as RealMarketingOverview } from './marketing-adapters';

type Supabase = Awaited<ReturnType<typeof createClient>>;

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

// Buckets a list of ISO date strings into the trailing N months (oldest
// first), regardless of the current KPI date-range filter — growth trends
// read best over a fixed longer window than the KPI cards do.
function bucketByMonth(dates: string[], months: number): TrendPoint[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (let i = 0; i < months; i++) {
    buckets.set(monthLabel(cursor), 0);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (const iso of dates) {
    const d = new Date(iso);
    if (d < windowStart) continue;
    const key = monthLabel(new Date(d.getFullYear(), d.getMonth(), 1));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
}

export interface ClientsOverview {
  total: number;
  active: number;
  newInRange: number;
  growthTrend: TrendPoint[];
}

export async function getClientsOverview(supabase: Supabase, rangeFrom: Date): Promise<ModuleResult<ClientsOverview>> {
  const { data, error } = await supabase.from('clients').select('is_active, date_joined');
  if (error || !data) return unavailable('Clients', error?.message ?? 'Failed to load clients.');

  const total = data.length;
  const active = data.filter((c) => c.is_active).length;
  const newInRange = data.filter((c) => new Date(c.date_joined) >= rangeFrom).length;
  const growthTrend = bucketByMonth(data.map((c) => c.date_joined), 6);

  return { available: true, data: { total, active, newInRange, growthTrend } };
}

export interface LeadsOverview {
  total: number;
  newInRange: number;
  conversionRatePct: number;
  statusCounts: Record<string, number>;
  trend: TrendPoint[];
}

export async function getLeadsOverview(supabase: Supabase, rangeFrom: Date): Promise<ModuleResult<LeadsOverview>> {
  const { data, error } = await supabase.from('website_leads').select('status, created_at');
  if (error || !data) return unavailable('Leads', error?.message ?? 'Failed to load leads.');

  const total = data.length;
  const newInRange = data.filter((l) => new Date(l.created_at) >= rangeFrom).length;
  const statusCounts: Record<string, number> = {};
  for (const row of data) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  const activeClients = statusCounts.active_client ?? 0;
  const conversionRatePct = total > 0 ? Math.round((activeClients / total) * 1000) / 10 : 0;
  const trend = bucketByMonth(data.map((l) => l.created_at), 6);

  return { available: true, data: { total, newInRange, conversionRatePct, statusCounts, trend } };
}

export interface OnboardingOverview {
  pendingCount: number;
  delayedCount: number;
  delayedItems: ActionItem[];
}

export async function getOnboardingOverview(supabase: Supabase): Promise<ModuleResult<OnboardingOverview>> {
  const inProgressStatuses = ['contacted', 'in_discussion', 'proposal_sent', 'contract_review', 'offline_onboarding'];
  const { data, error } = await supabase
    .from('website_leads')
    .select('id, business_name, status, follow_up_date')
    .in('status', inProgressStatuses);
  if (error || !data) return unavailable('Onboarding', error?.message ?? 'Failed to load onboarding cases.');

  const today = new Date().toISOString().slice(0, 10);
  const delayed = data.filter((l) => l.follow_up_date && l.follow_up_date < today);

  return {
    available: true,
    data: {
      pendingCount: data.length,
      delayedCount: delayed.length,
      delayedItems: delayed.slice(0, 10).map((l) => ({
        id: l.id,
        title: l.business_name,
        detail: `Follow-up was due ${l.follow_up_date}`,
        severity: 'medium',
        href: `/admin/inquiries/${l.id}`,
      })),
    },
  };
}

export interface SupportOverview {
  open: number;
  critical: number;
  statusCounts: Record<string, number>;
  criticalItems: ActionItem[];
}

export async function getSupportOverview(supabase: Supabase): Promise<ModuleResult<SupportOverview>> {
  const { data, error } = await supabase.from('support_tickets').select('id, title, status, priority');
  if (error || !data) return unavailable('Customer Support', error?.message ?? 'Failed to load support tickets.');

  const openStatuses = new Set(['open', 'in_progress', 'waiting_client']);
  const open = data.filter((t) => openStatuses.has(t.status)).length;
  const criticalRows = data.filter((t) => t.priority === 'urgent' && openStatuses.has(t.status));
  const statusCounts: Record<string, number> = {};
  for (const row of data) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;

  return {
    available: true,
    data: {
      open,
      critical: criticalRows.length,
      statusCounts,
      criticalItems: criticalRows.slice(0, 10).map((t) => ({
        id: t.id,
        title: t.title,
        detail: 'Urgent priority, unresolved',
        severity: 'critical',
        href: '/admin/support-tickets',
      })),
    },
  };
}

export interface TechnicalOverview {
  active: number;
  failed: number;
  activeAgents: number;
  statusCounts: Record<string, number>;
  failedItems: ActionItem[];
}

export async function getTechnicalOverview(supabase: Supabase): Promise<ModuleResult<TechnicalOverview>> {
  const [{ data: integrations, error: e1 }, { data: agents }] = await Promise.all([
    supabase.from('integration_health').select('id, service_type, api_status, error_message'),
    supabase.from('ai_agent_configs').select('agent_status'),
  ]);
  if (e1 || !integrations) return unavailable('Technical', e1?.message ?? 'Failed to load integration health.');

  const statusCounts: Record<string, number> = {};
  for (const row of integrations) statusCounts[row.api_status] = (statusCounts[row.api_status] ?? 0) + 1;
  const failedRows = integrations.filter((i) => i.api_status === 'failed');
  const agentFailed = (agents ?? []).filter((a) => a.agent_status === 'failed').length;
  const activeAgents = (agents ?? []).filter((a) => a.agent_status === 'active').length;

  return {
    available: true,
    data: {
      active: statusCounts.active ?? 0,
      failed: failedRows.length + agentFailed,
      activeAgents,
      statusCounts,
      failedItems: failedRows.slice(0, 10).map((i) => ({
        id: i.id,
        title: i.service_type,
        detail: i.error_message ?? 'Integration failing',
        severity: 'high',
        href: '/admin/integration-health',
      })),
    },
  };
}

export interface ServicesOverview {
  active: number;
}

export async function getServicesOverview(supabase: Supabase): Promise<ModuleResult<ServicesOverview>> {
  const { data, error } = await supabase.from('client_services').select('status');
  if (error || !data) return unavailable('Services', error?.message ?? 'Failed to load services.');

  return { available: true, data: { active: data.filter((s) => s.status === 'active').length } };
}

export async function getFinanceOverview(supabase: Supabase): Promise<ModuleResult<RealFinanceOverview>> {
  const data = await realGetFinanceOverview(supabase);
  return data ? { available: true, data } : unavailable('Finance', 'Failed to load finance data.');
}

export async function getContractsOverview(supabase: Supabase): Promise<ModuleResult<RealContractsOverview>> {
  const data = await realGetContractsOverview(supabase);
  return data ? { available: true, data } : unavailable('Contracts', 'Failed to load contract data.');
}

export async function getComplianceOverview(supabase: Supabase): Promise<ModuleResult<RealComplianceOverview>> {
  const data = await realGetComplianceOverview(supabase);
  return data ? { available: true, data } : unavailable('Compliance', 'Failed to load compliance data.');
}

export async function getSecurityOverview(supabase: Supabase): Promise<ModuleResult<RealSecurityOverview>> {
  const data = await realGetSecurityOverview(supabase);
  return data ? { available: true, data } : unavailable('Security', 'Failed to load security data.');
}

export async function getMarketingOverview(supabase: Supabase): Promise<ModuleResult<RealMarketingOverview>> {
  const data = await realGetMarketingOverview(supabase);
  return data ? { available: true, data } : unavailable('Marketing', 'Failed to load marketing data.');
}

export { INQUIRY_STATUSES, API_STATUSES, TICKET_STATUSES };
