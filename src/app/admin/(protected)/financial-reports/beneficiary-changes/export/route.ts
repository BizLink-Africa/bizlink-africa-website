import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { csvRow, csvResponseHeaders } from '@/lib/reports/csv';

export async function GET(request: Request) {
  let user;
  try {
    user = await requirePermission('financial_reports.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const merchant = searchParams.get('merchant');
  const status = searchParams.get('status');

  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('merchant_beneficiary_change_requests').select('*').order('requested_at', { ascending: false }).limit(5000);
  if (from) query = query.gte('requested_at', from);
  if (to) query = query.lte('requested_at', `${to}T23:59:59`);
  if (merchant) query = query.eq('merchant_id', merchant);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Never includes proposed_encrypted_value — only the already-masked form,
  // same "never log/export a raw beneficiary value" rule as everywhere else.
  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'beneficiary_changes', newValue: { from, to, merchant, status } });

  let csv = csvRow(['Merchant', 'Request Type', 'New Value (Masked)', 'Requested By', 'Status']);
  for (const r of data ?? []) csv += csvRow([merchantNameById.get(r.merchant_id) ?? r.merchant_id, r.request_type, r.proposed_masked_value ?? '', r.requested_by, r.status]);
  return new NextResponse(csv, { headers: csvResponseHeaders('beneficiary-changes.csv') });
}
