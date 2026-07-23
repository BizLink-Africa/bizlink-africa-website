import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const VALID_TYPES = new Set(['roles', 'departments', 'policies', 'approval-workflows', 'access-reviews']);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

export async function GET(request: Request) {
  let user;
  try {
    user = await requirePermission('governance.reports.export');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? '';
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  const supabase = await createClient();
  let csv = '';

  if (type === 'roles') {
    const [{ data: roles }, { data: staff }] = await Promise.all([
      supabase.from('roles').select('id, name, is_system, is_active'),
      supabase.from('staff_profiles').select('role').eq('is_active', true),
    ]);
    const counts: Record<string, number> = {};
    for (const s of staff ?? []) counts[s.role] = (counts[s.role] ?? 0) + 1;
    csv += csvRow(['Roles & Permissions Report']);
    csv += '\r\n';
    csv += csvRow(['Role', 'Type', 'Status', 'Assigned Users']);
    for (const r of roles ?? []) {
      csv += csvRow([r.name, r.is_system ? 'Default' : 'Custom', r.is_active ? 'Active' : 'Inactive', counts[r.id] ?? 0]);
    }
  }

  if (type === 'departments') {
    const [{ data: departments }, { data: staff }] = await Promise.all([
      supabase.from('departments').select('name, manager, description, status'),
      supabase.from('staff_profiles').select('department').eq('is_active', true),
    ]);
    const counts: Record<string, number> = {};
    for (const s of staff ?? []) {
      if (!s.department) continue;
      counts[s.department] = (counts[s.department] ?? 0) + 1;
    }
    csv += csvRow(['Departments Report']);
    csv += '\r\n';
    csv += csvRow(['Name', 'Manager', 'Staff Count', 'Description', 'Status']);
    for (const d of departments ?? []) {
      csv += csvRow([d.name, d.manager ?? '', counts[d.name] ?? 0, d.description ?? '', d.status]);
    }
  }

  if (type === 'policies') {
    const { data } = await supabase.from('governance_policies').select('title, category, version, owner, status, review_date');
    csv += csvRow(['Policies Report']);
    csv += '\r\n';
    csv += csvRow(['Title', 'Category', 'Version', 'Owner', 'Status', 'Review Date']);
    for (const p of data ?? []) {
      csv += csvRow([p.title, p.category, p.version, p.owner ?? '', p.status, p.review_date ?? '']);
    }
  }

  if (type === 'approval-workflows') {
    const { data } = await supabase.from('approval_workflows').select('name, category, approver_role, is_active');
    csv += csvRow(['Approval Workflows Report']);
    csv += '\r\n';
    csv += csvRow(['Name', 'Category', 'Approver Role', 'Status']);
    for (const w of data ?? []) {
      csv += csvRow([w.name, w.category, w.approver_role ?? '', w.is_active ? 'Active' : 'Inactive']);
    }
  }

  if (type === 'access-reviews') {
    const { data } = await supabase.from('access_reviews').select('user_label, role_label, department, decision, review_date, next_review_date');
    csv += csvRow(['Staff Access Reviews Report']);
    csv += '\r\n';
    csv += csvRow(['User', 'Role', 'Department', 'Decision', 'Review Date', 'Next Review']);
    for (const r of data ?? []) {
      csv += csvRow([r.user_label, r.role_label ?? '', r.department ?? '', r.decision, r.review_date, r.next_review_date ?? '']);
    }
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'export',
    module: 'governance_reports',
    recordId: type,
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-governance-${type}-report.csv"`,
    },
  });
}
