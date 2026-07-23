import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';

const VALID_TYPES = new Set([
  'reviews', 'client-compliance', 'contract-compliance', 'data-protection', 'policy-acknowledgements', 'access-reviews',
]);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

export async function GET(request: Request) {
  try {
    await requirePermission('compliance.reports.export');
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

  if (type === 'reviews') {
    const { data } = await supabase.from('compliance_reviews').select('review_number, title, category, reviewer, risk_level, status, due_date, completed_date');
    csv += csvRow(['Compliance Reviews Report']);
    csv += '\r\n';
    csv += csvRow(['Review #', 'Title', 'Type', 'Officer', 'Risk', 'Status', 'Due Date', 'Completed']);
    for (const r of data ?? []) {
      csv += csvRow([r.review_number ?? '', r.title, r.category, r.reviewer ?? '', r.risk_level ?? '', r.status, r.due_date ?? '', r.completed_date ?? '']);
    }
  }

  if (type === 'client-compliance') {
    const { data } = await supabase.from('client_compliance').select('compliance_status, risk_level, review_date, next_review_date, clients(client_name)');
    csv += csvRow(['Client Compliance Report']);
    csv += '\r\n';
    csv += csvRow(['Client', 'Status', 'Risk', 'Review Date', 'Next Review']);
    for (const r of (data ?? []) as unknown as { compliance_status: string; risk_level: string; review_date: string | null; next_review_date: string | null; clients: { client_name: string } | null }[]) {
      csv += csvRow([r.clients?.client_name ?? '', r.compliance_status, r.risk_level, r.review_date ?? '', r.next_review_date ?? '']);
    }
  }

  if (type === 'contract-compliance') {
    const { data } = await supabase.from('contract_compliance').select('review_status, approval_status, findings, review_date, contracts(contract_number)');
    csv += csvRow(['Contract Compliance Report']);
    csv += '\r\n';
    csv += csvRow(['Contract', 'Review Status', 'Approval', 'Findings', 'Review Date']);
    for (const r of (data ?? []) as unknown as { review_status: string; approval_status: string; findings: string | null; review_date: string | null; contracts: { contract_number: string } | null }[]) {
      csv += csvRow([r.contracts?.contract_number ?? '', r.review_status, r.approval_status, r.findings ?? '', r.review_date ?? '']);
    }
  }

  if (type === 'data-protection') {
    const { data } = await supabase.from('data_protection_activities').select('processing_activity, data_category, legal_basis, retention_period, risk_level, review_date');
    csv += csvRow(['Data Protection Report']);
    csv += '\r\n';
    csv += csvRow(['Processing Activity', 'Data Category', 'Legal Basis', 'Retention', 'Risk', 'Review Date']);
    for (const r of data ?? []) {
      csv += csvRow([r.processing_activity, r.data_category, r.legal_basis ?? '', r.retention_period ?? '', r.risk_level, r.review_date ?? '']);
    }
  }

  if (type === 'policy-acknowledgements') {
    const { data } = await supabase.from('policy_acknowledgements').select('acknowledged_at, governance_policies(title, version), staff_profiles(full_name, email)');
    csv += csvRow(['Policy Acknowledgement Report']);
    csv += '\r\n';
    csv += csvRow(['Policy', 'Version', 'Staff Member', 'Email', 'Acknowledged At']);
    for (const r of (data ?? []) as unknown as { acknowledged_at: string; governance_policies: { title: string; version: string } | null; staff_profiles: { full_name: string; email: string } | null }[]) {
      csv += csvRow([r.governance_policies?.title ?? '', r.governance_policies?.version ?? '', r.staff_profiles?.full_name ?? '', r.staff_profiles?.email ?? '', r.acknowledged_at]);
    }
  }

  if (type === 'access-reviews') {
    const { data } = await supabase.from('access_reviews').select('user_label, role_label, department, excessive_access_flag, decision, review_date, next_review_date, created_at');
    csv += csvRow(['Access Review Report']);
    csv += '\r\n';
    csv += csvRow(['User', 'Role', 'Department', 'Excessive Access', 'Decision', 'Review Date', 'Next Review', 'Created']);
    for (const r of data ?? []) {
      csv += csvRow([r.user_label, r.role_label ?? '', r.department ?? '', r.excessive_access_flag ? 'Yes' : 'No', r.decision, r.review_date ?? '', r.next_review_date ?? '', r.created_at]);
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-${type}-report.csv"`,
    },
  });
}
