import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { csvRow, csvResponseHeaders } from '@/lib/reports/csv';

export async function GET(request: Request) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return NextResponse.json({ error: 'This module is archived. BizLink Africa does not handle merchant funds or settlements.' }, { status: 403 });
  }

  let user;
  try {
    user = await requirePermission('financial_reports.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const moduleFilter = searchParams.get('module');

  const supabase = await createClient();
  let query = supabase.from('audit_logs').select('*').in('record_type', ['finance', 'compliance']).order('created_at', { ascending: false }).limit(10000);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);
  if (moduleFilter) query = query.eq('module', moduleFilter);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The export of the audit trail is itself audited — this line is what
  // makes "log every export" recursive/complete rather than having one
  // report whose own export is invisible to itself.
  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'audit_trail', newValue: { from, to, module: moduleFilter } });

  let csv = csvRow(['When', 'Performed By', 'Action', 'Module', 'Record', 'Result']);
  for (const a of data ?? []) csv += csvRow([a.created_at, a.performed_by, a.action_type, a.module, a.record_id ?? '', a.result]);
  return new NextResponse(csv, { headers: csvResponseHeaders('financial-audit-trail.csv') });
}
