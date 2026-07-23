import { NextResponse } from 'next/server';
import { requirePermission, getUserPermissions } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { getCrossDepartmentMetrics } from '@/lib/dashboard/governance-analytics-adapters';

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

// Export restriction is two-layer, same shape as the rest of the app's
// RLS+action gating: governance.analytics.export gates whether you can hit
// this route at all, and getUserPermissions() then strips any metric whose
// OWN department permission you don't hold — you can never export a number
// you couldn't already see on the page. Every export writes an audit_logs
// row so Audit Summary's "Sensitive exports" section has something real to
// show, not a placeholder.
export async function GET() {
  let user;
  try {
    user = await requirePermission('governance.analytics.export');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const permissions = await getUserPermissions();
  const supabase = await createClient();
  const metrics = await getCrossDepartmentMetrics(supabase);
  const visibleMetrics = metrics.filter((m) => permissions.has(m.permission));

  let csv = csvRow(['Cross-Department Analytics Export']);
  csv += csvRow([`Exported by ${user.email ?? 'unknown'} on ${new Date().toISOString()}`]);
  csv += '\r\n';
  csv += csvRow(['Department', 'Metric', 'Value']);
  for (const m of visibleMetrics) {
    csv += csvRow([m.department, m.label, m.value]);
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'export',
    module: 'governance_analytics',
    newValue: { metricsExported: visibleMetrics.map((m) => m.key) },
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bizlink-governance-analytics.csv"',
    },
  });
}
