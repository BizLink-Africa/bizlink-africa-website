import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';

// Modules the Executive Action Center actually acts on — scopes the export
// to executive-relevant history rather than the entire audit_logs table.
const EXECUTIVE_MODULES = [
  'contracts',
  'expenses',
  'proforma_invoices',
  'invoices',
  'website_leads',
  'support_tickets',
  'integration_health',
  'security_events',
  'compliance_reviews',
  'executive_follow_ups',
];

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

// Decision history is derived entirely from audit_logs + executive_follow_ups
// — no separate decisions table, so this can never drift from what actually
// happened (same "no separate reporting pipeline" philosophy as the
// existing ceo/export/route.ts).
export async function GET() {
  try {
    await requirePermission('executive.actions.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await createClient();
  const [{ data: auditRows }, { data: followUps }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('performed_by, action_type, module, record_id, new_value, created_at')
      .in('module', EXECUTIVE_MODULES)
      .in('action_type', ['comment', 'assign_follow_up', 'escalate', 'complete_follow_up'])
      .order('created_at', { ascending: false }),
    supabase
      .from('executive_follow_ups')
      .select('source_module, source_id, action_type, assigned_to, priority, deadline, status, created_by, created_at')
      .order('created_at', { ascending: false }),
  ]);

  let csv = csvRow(['BizLink Africa — Executive Decision History Export']);
  csv += csvRow([`Generated: ${new Date().toISOString()}`]);
  csv += '\r\n';

  csv += csvRow(['Audit Log Entries']);
  csv += csvRow(['Date', 'Performed By', 'Action', 'Module', 'Record ID', 'Comment']);
  for (const row of auditRows ?? []) {
    const comment = (row.new_value as { comment?: string } | null)?.comment ?? '';
    csv += csvRow([row.created_at, row.performed_by, row.action_type, row.module, row.record_id ?? '', comment]);
  }

  csv += '\r\n';
  csv += csvRow(['Follow-ups / Escalations']);
  csv += csvRow(['Date', 'Module', 'Record ID', 'Type', 'Assigned To', 'Priority', 'Deadline', 'Status', 'Created By']);
  for (const row of followUps ?? []) {
    csv += csvRow([
      row.created_at,
      row.source_module,
      row.source_id,
      row.action_type,
      row.assigned_to ?? '',
      row.priority,
      row.deadline ?? '',
      row.status,
      row.created_by ?? '',
    ]);
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bizlink-executive-decision-history.csv"',
    },
  });
}
