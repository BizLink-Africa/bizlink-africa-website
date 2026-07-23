import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { computeSlaState } from '@/data/tickets';

const VALID_TYPES = new Set([
  'ticket-volume', 'sla-compliance', 'agent-performance', 'resolution-time', 'csat', 'escalation', 'category',
]);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

function hoursBetween(start: string, end: string): number {
  return Math.round(((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60)) * 10) / 10;
}

export async function GET(request: Request) {
  try {
    await requirePermission('support.reports.export');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? '';
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: staffRows } = await supabase.from('staff_profiles').select('id, full_name');
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  let csv = '';

  if (type === 'ticket-volume') {
    const { data: tickets } = await supabase.from('support_tickets').select('ticket_number, title, status, priority, category, created_at');
    csv += csvRow(['Ticket Volume Report']);
    csv += '\r\n';
    csv += csvRow(['Ticket Number', 'Title', 'Status', 'Priority', 'Category', 'Created']);
    for (const t of tickets ?? []) {
      csv += csvRow([t.ticket_number ?? '', t.title, t.status, t.priority, t.category, t.created_at]);
    }
  }

  if (type === 'sla-compliance') {
    const { data: tickets } = await supabase.from('support_tickets').select('ticket_number, priority, response_deadline, resolution_deadline, first_response_at, resolved_at');
    csv += csvRow(['SLA Compliance Report']);
    csv += '\r\n';
    csv += csvRow(['Ticket Number', 'Priority', 'Response SLA', 'Resolution SLA']);
    for (const t of tickets ?? []) {
      const responseState = computeSlaState(t.response_deadline, t.first_response_at) ?? '';
      const resolutionState = computeSlaState(t.resolution_deadline, t.resolved_at) ?? '';
      csv += csvRow([t.ticket_number ?? '', t.priority, responseState, resolutionState]);
    }
  }

  if (type === 'agent-performance') {
    const [{ data: tickets }, { data: satisfaction }] = await Promise.all([
      supabase.from('support_tickets').select('assigned_user_id, status'),
      supabase.from('support_ticket_satisfaction').select('agent_user_id, rating'),
    ]);
    const handled = new Map<string, number>();
    const resolved = new Map<string, number>();
    for (const t of tickets ?? []) {
      if (!t.assigned_user_id) continue;
      handled.set(t.assigned_user_id, (handled.get(t.assigned_user_id) ?? 0) + 1);
      if (t.status === 'resolved') resolved.set(t.assigned_user_id, (resolved.get(t.assigned_user_id) ?? 0) + 1);
    }
    const ratingsByAgent = new Map<string, number[]>();
    for (const s of satisfaction ?? []) {
      if (!s.agent_user_id) continue;
      ratingsByAgent.set(s.agent_user_id, [...(ratingsByAgent.get(s.agent_user_id) ?? []), s.rating]);
    }
    csv += csvRow(['Agent Performance Report']);
    csv += '\r\n';
    csv += csvRow(['Agent', 'Tickets Handled', 'Tickets Resolved', 'Average CSAT']);
    for (const [agentId, count] of handled.entries()) {
      const ratings = ratingsByAgent.get(agentId) ?? [];
      const avgCsat = ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : '';
      csv += csvRow([staffNameById.get(agentId) ?? agentId, count, resolved.get(agentId) ?? 0, avgCsat]);
    }
  }

  if (type === 'resolution-time') {
    const { data: tickets } = await supabase.from('support_tickets').select('ticket_number, created_at, first_response_at, resolved_at').eq('status', 'resolved');
    csv += csvRow(['Resolution Time Report']);
    csv += '\r\n';
    csv += csvRow(['Ticket Number', 'First-Response (hours)', 'Resolution Time (hours)']);
    for (const t of tickets ?? []) {
      const firstResponseHours = t.first_response_at ? hoursBetween(t.created_at, t.first_response_at) : '';
      const resolutionHours = t.resolved_at ? hoursBetween(t.created_at, t.resolved_at) : '';
      csv += csvRow([t.ticket_number ?? '', firstResponseHours, resolutionHours]);
    }
  }

  if (type === 'csat') {
    const { data: entries } = await supabase.from('support_ticket_satisfaction').select('ticket_id, rating, feedback, created_at, support_tickets(ticket_number)');
    csv += csvRow(['Customer Satisfaction Report']);
    csv += '\r\n';
    csv += csvRow(['Ticket Number', 'Rating', 'Feedback', 'Date']);
    for (const e of (entries ?? []) as unknown as { rating: number; feedback: string | null; created_at: string; support_tickets: { ticket_number: string | null } | null }[]) {
      csv += csvRow([e.support_tickets?.ticket_number ?? '', e.rating, e.feedback ?? '', e.created_at]);
    }
  }

  if (type === 'escalation') {
    const { data: tickets } = await supabase.from('support_tickets').select('ticket_number, title, escalated_to, escalation_reason, escalated_at').not('escalated_to', 'is', null);
    csv += csvRow(['Escalation Report']);
    csv += '\r\n';
    csv += csvRow(['Ticket Number', 'Title', 'Escalated To', 'Reason', 'Escalated At']);
    for (const t of tickets ?? []) {
      csv += csvRow([t.ticket_number ?? '', t.title, t.escalated_to ?? '', t.escalation_reason ?? '', t.escalated_at ?? '']);
    }
  }

  if (type === 'category') {
    const { data: tickets } = await supabase.from('support_tickets').select('category, created_at, resolved_at');
    const counts = new Map<string, number>();
    const resolutionHoursByCategory = new Map<string, number[]>();
    for (const t of tickets ?? []) {
      counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      if (t.resolved_at) {
        resolutionHoursByCategory.set(t.category, [...(resolutionHoursByCategory.get(t.category) ?? []), hoursBetween(t.created_at, t.resolved_at)]);
      }
    }
    csv += csvRow(['Category Report']);
    csv += '\r\n';
    csv += csvRow(['Category', 'Ticket Count', 'Avg Resolution Time (hours)']);
    for (const [category, count] of counts.entries()) {
      const hours = resolutionHoursByCategory.get(category) ?? [];
      const avg = hours.length > 0 ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10 : '';
      csv += csvRow([category, count, avg]);
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-${type}-report.csv"`,
    },
  });
}
