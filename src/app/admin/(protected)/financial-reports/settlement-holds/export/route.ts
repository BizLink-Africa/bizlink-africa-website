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
  const merchant = searchParams.get('merchant');
  const status = searchParams.get('status');

  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('settlement_holds').select('*').order('placed_at', { ascending: false }).limit(5000);
  if (from) query = query.gte('placed_at', from);
  if (to) query = query.lte('placed_at', `${to}T23:59:59`);
  if (merchant) query = query.eq('merchant_id', merchant);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'settlement_holds', newValue: { from, to, merchant, status } });

  let csv = csvRow(['Merchant', 'Amount', 'Reason', 'Placed At', 'Status']);
  for (const h of data ?? []) csv += csvRow([merchantNameById.get(h.merchant_id) ?? h.merchant_id, h.hold_amount, h.hold_reason, h.placed_at, h.status]);
  return new NextResponse(csv, { headers: csvResponseHeaders('settlement-holds.csv') });
}
