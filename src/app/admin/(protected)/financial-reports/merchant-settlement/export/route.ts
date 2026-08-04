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
  const status = searchParams.get('status');

  const supabase = await createClient();
  let query = supabase.from('settlement_batches').select('*').order('settlement_date', { ascending: false }).limit(5000);
  if (from) query = query.gte('settlement_date', from);
  if (to) query = query.lte('settlement_date', to);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'merchant_settlement', newValue: { from, to, status } });

  let csv = csvRow(['Batch', 'Settlement Date', 'Merchants', 'Transactions', 'Net Total', 'Status']);
  for (const b of data ?? []) {
    csv += csvRow([b.batch_number, b.settlement_date, b.merchant_count, b.transaction_count, b.merchant_net_total, b.status]);
  }
  return new NextResponse(csv, { headers: csvResponseHeaders('merchant-settlement.csv') });
}
