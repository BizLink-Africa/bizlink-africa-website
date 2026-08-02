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
  const status = searchParams.get('status') ?? 'failed';

  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('merchant_payouts').select('*').eq('status', status).order('requested_at', { ascending: false }).limit(5000);
  if (from) query = query.gte('requested_at', from);
  if (to) query = query.lte('requested_at', `${to}T23:59:59`);
  if (merchant) query = query.eq('merchant_id', merchant);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'failed_payouts', newValue: { from, to, merchant, status } });

  let csv = csvRow(['Reference', 'Merchant', 'Amount', 'Failure Code', 'Failure Reason', 'Retries', 'Requested At']);
  for (const p of data ?? []) {
    csv += csvRow([p.payout_reference, merchantNameById.get(p.merchant_id) ?? p.merchant_id, p.amount, p.failure_code ?? '', p.failure_reason ?? '', p.retry_count, p.requested_at]);
  }
  return new NextResponse(csv, { headers: csvResponseHeaders('failed-payouts.csv') });
}
