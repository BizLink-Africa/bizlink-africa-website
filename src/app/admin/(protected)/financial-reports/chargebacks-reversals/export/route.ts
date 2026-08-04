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
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let caseQuery = supabase.from('chargeback_cases').select('*').order('opened_at', { ascending: false }).limit(5000);
  if (from) caseQuery = caseQuery.gte('opened_at', from);
  if (to) caseQuery = caseQuery.lte('opened_at', `${to}T23:59:59`);
  if (merchant) caseQuery = caseQuery.eq('merchant_id', merchant);

  let reversalQuery = supabase.from('manual_reversal_requests').select('*').order('requested_at', { ascending: false }).limit(5000);
  if (from) reversalQuery = reversalQuery.gte('requested_at', from);
  if (to) reversalQuery = reversalQuery.lte('requested_at', `${to}T23:59:59`);
  if (merchant) reversalQuery = reversalQuery.eq('merchant_id', merchant);

  const [{ data: cases, error: caseError }, { data: reversals, error: reversalError }] = await Promise.all([caseQuery, reversalQuery]);
  if (caseError || reversalError) return NextResponse.json({ error: (caseError ?? reversalError)?.message }, { status: 400 });

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'chargebacks_reversals', newValue: { from, to, merchant } });

  let csv = csvRow(['Chargeback Cases']);
  csv += csvRow(['Case', 'Merchant', 'Disputed Amount', 'Reason', 'Status']);
  for (const c of cases ?? []) csv += csvRow([c.case_reference, merchantNameById.get(c.merchant_id) ?? c.merchant_id, c.disputed_amount, c.reason, c.case_status]);
  csv += '\r\n';
  csv += csvRow(['Manual Reversals']);
  csv += csvRow(['Merchant', 'Amount', 'Reason', 'Status']);
  for (const r of reversals ?? []) csv += csvRow([merchantNameById.get(r.merchant_id) ?? r.merchant_id, r.reversal_amount, r.reason, r.status]);

  return new NextResponse(csv, { headers: csvResponseHeaders('chargebacks-reversals.csv') });
}
