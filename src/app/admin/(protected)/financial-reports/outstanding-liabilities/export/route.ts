import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { csvRow, csvResponseHeaders } from '@/lib/reports/csv';

export async function GET() {
  let user;
  try {
    user = await requirePermission('financial_reports.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('v_merchant_outstanding_liabilities').select('*').order('unsettled_net_amount', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'outstanding_liabilities' });

  let csv = csvRow(['Merchant', 'Unsettled Transactions', 'Unsettled Net Amount']);
  for (const r of data ?? []) csv += csvRow([r.business_name, r.unsettled_transaction_count, r.unsettled_net_amount]);
  return new NextResponse(csv, { headers: csvResponseHeaders('outstanding-liabilities.csv') });
}
