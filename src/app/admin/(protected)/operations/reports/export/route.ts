import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';

const VALID_TYPES = new Set(['onboarding-pipeline', 'contract-status', 'project-delivery', 'task-log']);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

// One shared route handler for all Operations reports, selected by `type` —
// same pattern as the CRM/Executive report exports, reusing live data.
export async function GET(request: Request) {
  try {
    await requirePermission('operations.reports.export');
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

  if (type === 'onboarding-pipeline') {
    const { data } = await supabase
      .from('onboarding_cases')
      .select('case_number, stage, priority, assigned_user_id, due_date, created_at, clients(business_name), website_leads(business_name)');
    const rows = data as unknown as
      | { case_number: string; stage: string; priority: string; assigned_user_id: string | null; due_date: string | null; created_at: string; clients: { business_name: string } | null; website_leads: { business_name: string } | null }[]
      | null;
    csv += csvRow(['Onboarding Pipeline Report']);
    csv += '\r\n';
    csv += csvRow(['Case Number', 'Client/Lead', 'Stage', 'Priority', 'Assigned To', 'Due Date', 'Created']);
    for (const r of rows ?? []) {
      csv += csvRow([
        r.case_number,
        r.clients?.business_name ?? r.website_leads?.business_name ?? '',
        r.stage,
        r.priority,
        r.assigned_user_id ? staffNameById.get(r.assigned_user_id) ?? '' : '',
        r.due_date ?? '',
        r.created_at,
      ]);
    }
  }

  if (type === 'contract-status') {
    const { data: contracts } = await supabase
      .from('contracts')
      .select('contract_number, contract_title, status, contract_value, currency, end_date');
    csv += csvRow(['Contract Status Report']);
    csv += '\r\n';
    csv += csvRow(['Number', 'Title', 'Status', 'Value', 'End Date']);
    for (const c of contracts ?? []) {
      csv += csvRow([c.contract_number, c.contract_title, c.status, c.contract_value ? `${c.currency} ${c.contract_value}` : '', c.end_date ?? '']);
    }
  }

  if (type === 'project-delivery') {
    const { data: projects } = await supabase
      .from('projects')
      .select('project_number, project_name, status, progress, target_completion_date, project_owner');
    csv += csvRow(['Project Delivery Report']);
    csv += '\r\n';
    csv += csvRow(['Number', 'Name', 'Status', 'Progress', 'Target Date', 'Owner']);
    for (const p of projects ?? []) {
      csv += csvRow([
        p.project_number,
        p.project_name,
        p.status,
        `${p.progress}%`,
        p.target_completion_date ?? '',
        p.project_owner ? staffNameById.get(p.project_owner) ?? '' : '',
      ]);
    }
  }

  if (type === 'task-log') {
    const { data: tasks } = await supabase
      .from('operational_tasks')
      .select('task_number, title, status, priority, assigned_user_id, due_date');
    csv += csvRow(['Operational Task Log']);
    csv += '\r\n';
    csv += csvRow(['Number', 'Title', 'Status', 'Priority', 'Assigned To', 'Due Date']);
    for (const t of tasks ?? []) {
      csv += csvRow([
        t.task_number,
        t.title,
        t.status,
        t.priority,
        t.assigned_user_id ? staffNameById.get(t.assigned_user_id) ?? '' : '',
        t.due_date ?? '',
      ]);
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-${type}-report.csv"`,
    },
  });
}
