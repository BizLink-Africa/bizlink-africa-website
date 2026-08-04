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

  const supabase = await createClient();
  let query = supabase.from('v_daily_collections_by_merchant').select('*').order('collection_date', { ascending: false }).limit(5000);
  if (from) query = query.gte('collection_date', from);
  if (to) query = query.lte('collection_date', to);
  if (merchant) query = query.eq('merchant_id', merchant);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'export_report_csv',
    module: 'financial_reports',
    recordId: 'daily_collections',
    newValue: { from, to, merchant },
  });

  let csv = csvRow(['Date', 'Merchant', 'Transactions', 'Gross', 'Provider Fees', 'BizLink Commission', 'Net']);
  for (const r of data ?? []) {
    csv += csvRow([r.collection_date, r.business_name, r.transaction_count, r.gross_amount, r.provider_fee_total, r.bizlink_commission_total, r.net_amount]);
  }

  return new NextResponse(csv, { headers: csvResponseHeaders('daily-collections.csv') });
}
