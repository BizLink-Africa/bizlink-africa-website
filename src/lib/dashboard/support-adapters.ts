import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { OPEN_TICKET_STATUSES, computeSlaState } from '@/data/tickets';

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface TicketRow {
  id: string;
  client_id: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_user_id: string | null;
  response_deadline: string | null;
  resolution_deadline: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  reopened_count: number;
  created_at: string;
}

export interface SupportOverview {
  openTicketsCount: number;
  pendingTicketsCount: number;
  assignedTicketsCount: number;
  unassignedTicketsCount: number;
  resolvedTicketsCount: number;
  escalatedTicketsCount: number;
  criticalTicketsCount: number;
  slaBreachesCount: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  csatAverage: number | null;
  reopenedTicketsCount: number;
  byClient: { clientId: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byAgent: { agentId: string; count: number }[];
}

function hoursBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

export async function getSupportOverview(supabase: Supabase): Promise<SupportOverview | null> {
  const [{ data: tickets, error }, { data: satisfaction }] = await Promise.all([
    supabase
      .from('support_tickets')
      .select('id, client_id, category, priority, status, assigned_user_id, response_deadline, resolution_deadline, first_response_at, resolved_at, reopened_count, created_at'),
    supabase.from('support_ticket_satisfaction').select('rating'),
  ]);

  if (error || !tickets) return null;

  const rows = tickets as TicketRow[];
  const openRows = rows.filter((t) => OPEN_TICKET_STATUSES.includes(t.status as (typeof OPEN_TICKET_STATUSES)[number]));

  const now = new Date();
  const slaBreachesCount = openRows.filter((t) => {
    const responseState = computeSlaState(t.response_deadline, t.first_response_at, now);
    const resolutionState = computeSlaState(t.resolution_deadline, t.resolved_at, now);
    return responseState === 'breached' || resolutionState === 'breached';
  }).length;

  const firstResponseHours = rows.filter((t) => t.first_response_at).map((t) => hoursBetween(t.created_at, t.first_response_at as string));
  const resolutionHours = rows.filter((t) => t.resolved_at).map((t) => hoursBetween(t.created_at, t.resolved_at as string));

  const byClient = Object.values(
    rows.reduce<Record<string, { clientId: string; count: number }>>((acc, t) => {
      if (!t.client_id) return acc;
      acc[t.client_id] = acc[t.client_id] ?? { clientId: t.client_id, count: 0 };
      acc[t.client_id].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  const byCategory = Object.values(
    rows.reduce<Record<string, { category: string; count: number }>>((acc, t) => {
      acc[t.category] = acc[t.category] ?? { category: t.category, count: 0 };
      acc[t.category].count += 1;
      return acc;
    }, {})
  );

  const byAgent = Object.values(
    rows.reduce<Record<string, { agentId: string; count: number }>>((acc, t) => {
      if (!t.assigned_user_id) return acc;
      acc[t.assigned_user_id] = acc[t.assigned_user_id] ?? { agentId: t.assigned_user_id, count: 0 };
      acc[t.assigned_user_id].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  const ratings = (satisfaction ?? []).map((s) => s.rating);

  return {
    openTicketsCount: rows.filter((t) => t.status === 'open').length,
    pendingTicketsCount: rows.filter((t) => t.status === 'waiting_client' || t.status === 'waiting_internal').length,
    assignedTicketsCount: openRows.filter((t) => t.assigned_user_id).length,
    unassignedTicketsCount: openRows.filter((t) => !t.assigned_user_id).length,
    resolvedTicketsCount: rows.filter((t) => t.status === 'resolved').length,
    escalatedTicketsCount: rows.filter((t) => t.status === 'escalated').length,
    criticalTicketsCount: openRows.filter((t) => t.priority === 'urgent').length,
    slaBreachesCount,
    avgFirstResponseHours: average(firstResponseHours),
    avgResolutionHours: average(resolutionHours),
    csatAverage: average(ratings),
    reopenedTicketsCount: rows.filter((t) => t.reopened_count > 0).length,
    byClient: byClient.slice(0, 10),
    byCategory,
    byAgent: byAgent.slice(0, 10),
  };
}
