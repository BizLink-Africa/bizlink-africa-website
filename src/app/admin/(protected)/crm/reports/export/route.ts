import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';

const VALID_TYPES = new Set(['lead-pipeline', 'client-growth', 'opportunity', 'proposal-status', 'follow-up']);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

// One shared route handler for all 5 CRM reports, selected by `type` — same
// pattern as the Executive Reports export, reusing live data so no report
// can drift from what the CRM pages actually show.
export async function GET(request: Request) {
  try {
    await requirePermission('crm.reports.export');
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

  if (type === 'lead-pipeline') {
    const { data: leads } = await supabase
      .from('website_leads')
      .select('lead_number, business_name, stage, lead_score, lead_source, assigned_user_id, created_at');
    csv += csvRow(['Lead Pipeline Report']);
    csv += '\r\n';
    csv += csvRow(['Lead Number', 'Business Name', 'Stage', 'Lead Score', 'Lead Source', 'Assigned To', 'Created']);
    for (const l of leads ?? []) {
      csv += csvRow([
        l.lead_number ?? '',
        l.business_name,
        l.stage,
        l.lead_score,
        l.lead_source ?? '',
        l.assigned_user_id ? staffNameById.get(l.assigned_user_id) ?? '' : '',
        l.created_at,
      ]);
    }
  }

  if (type === 'client-growth') {
    const { data: clients } = await supabase.from('clients').select('client_number, business_name, industry, date_joined, is_active');
    csv += csvRow(['Client Growth Report']);
    csv += '\r\n';
    csv += csvRow(['Client Number', 'Business Name', 'Industry', 'Date Joined', 'Active']);
    for (const c of clients ?? []) {
      csv += csvRow([c.client_number ?? '', c.business_name, c.industry ?? '', c.date_joined, c.is_active ? 'Yes' : 'No']);
    }
  }

  if (type === 'opportunity') {
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('opportunity_number, name, estimated_value, currency, probability, stage, expected_close_date, owner_user_id');
    csv += csvRow(['Opportunity Report']);
    csv += '\r\n';
    csv += csvRow(['Number', 'Name', 'Value', 'Probability', 'Stage', 'Expected Close', 'Owner']);
    for (const o of opportunities ?? []) {
      csv += csvRow([
        o.opportunity_number,
        o.name,
        `${o.currency} ${o.estimated_value}`,
        `${o.probability}%`,
        o.stage,
        o.expected_close_date ?? '',
        o.owner_user_id ? staffNameById.get(o.owner_user_id) ?? '' : '',
      ]);
    }
  }

  if (type === 'proposal-status') {
    const { data: proposals } = await supabase.from('proposals').select('proposal_number, pricing_summary_total, currency, status, valid_until');
    csv += csvRow(['Proposal Status Report']);
    csv += '\r\n';
    csv += csvRow(['Number', 'Total', 'Status', 'Valid Until']);
    for (const p of proposals ?? []) {
      csv += csvRow([p.proposal_number, `${p.currency} ${p.pricing_summary_total}`, p.status, p.valid_until ?? '']);
    }
  }

  if (type === 'follow-up') {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('crm_follow_ups')
      .select('follow_up_date, communication_type, status, assigned_user_id, website_leads(business_name), clients(business_name)');
    const followUps = data as unknown as
      | { follow_up_date: string; communication_type: string; status: string; assigned_user_id: string | null; website_leads: { business_name: string } | null; clients: { business_name: string } | null }[]
      | null;
    csv += csvRow(['Follow-up Report']);
    csv += '\r\n';
    csv += csvRow(['Date', 'Lead/Client', 'Type', 'Status', 'Assigned To', 'Overdue']);
    for (const f of followUps ?? []) {
      const name = f.clients?.business_name ?? f.website_leads?.business_name ?? '';
      const overdue = f.status === 'scheduled' && f.follow_up_date < today ? 'Yes' : 'No';
      csv += csvRow([
        f.follow_up_date,
        name,
        f.communication_type,
        f.status,
        f.assigned_user_id ? staffNameById.get(f.assigned_user_id) ?? '' : '',
        overdue,
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
