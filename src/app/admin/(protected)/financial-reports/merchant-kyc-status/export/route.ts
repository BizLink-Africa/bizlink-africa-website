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
  const status = searchParams.get('status');

  const supabase = await createClient();
  let query = supabase.from('merchants').select('id, business_name, onboarding_status, risk_status').order('business_name');
  if (status) query = query.eq('onboarding_status', status);
  const { data: merchants, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: kycRows } = await supabase.from('merchant_kyc_reviews').select('merchant_id, partner_decision, recorded_at').order('recorded_at', { ascending: false });
  const latestKycByMerchant = new Map<string, string>();
  for (const k of kycRows ?? []) {
    if (!latestKycByMerchant.has(k.merchant_id)) latestKycByMerchant.set(k.merchant_id, k.partner_decision);
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'export_report_csv', module: 'financial_reports', recordId: 'merchant_kyc_status', newValue: { status } });

  let csv = csvRow(['Merchant', 'Onboarding Status', 'Risk', 'Latest Partner KYC Decision']);
  for (const m of merchants ?? []) csv += csvRow([m.business_name, m.onboarding_status, m.risk_status, latestKycByMerchant.get(m.id) ?? 'not_yet_submitted']);
  return new NextResponse(csv, { headers: csvResponseHeaders('merchant-kyc-status.csv') });
}
