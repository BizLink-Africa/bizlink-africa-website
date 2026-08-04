import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { checkArchivedFinancialPrototypeAccess } from '@/lib/archived-financial-prototype';
import { createClient } from '@/lib/supabase/server';
import type { MerchantPayout } from '@/data/payouts';

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

// Settlement confirmation export. Never includes a raw beneficiary
// destination value — only the already-masked form.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkArchivedFinancialPrototypeAccess();
  if (!access.ok) {
    return NextResponse.json({ error: 'This module is archived. BizLink Africa does not handle merchant funds or settlements.' }, { status: 403 });
  }

  try {
    await requirePermission('payouts.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: payout, error } = await supabase.from('merchant_payouts').select('*').eq('id', id).maybeSingle();
  if (error || !payout) {
    return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  }
  const p = payout as MerchantPayout;

  const [{ data: merchant }, { data: beneficiary }, { data: batch }] = await Promise.all([
    supabase.from('merchants').select('business_name').eq('id', p.merchant_id).maybeSingle(),
    p.beneficiary_id
      ? supabase.from('merchant_settlement_beneficiaries').select('masked_destination_value, bank_or_network_name').eq('id', p.beneficiary_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('settlement_batches').select('batch_number, settlement_date').eq('id', p.batch_id).maybeSingle(),
  ]);

  let csv = csvRow(['Settlement Confirmation']);
  csv += csvRow(['Payout Reference', p.payout_reference]);
  csv += csvRow(['Merchant', merchant?.business_name ?? p.merchant_id]);
  csv += csvRow(['Settlement Batch', batch?.batch_number ?? p.batch_id]);
  csv += csvRow(['Settlement Date', batch?.settlement_date ?? '']);
  csv += csvRow(['Amount', p.amount]);
  csv += csvRow(['Currency', p.currency]);
  csv += csvRow(['Destination Type', p.destination_type ?? '']);
  csv += csvRow(['Beneficiary (Masked)', beneficiary?.masked_destination_value ?? '']);
  csv += csvRow(['Bank / Network', beneficiary?.bank_or_network_name ?? '']);
  csv += csvRow(['Status', p.status]);
  csv += csvRow(['Provider Payout Reference', p.provider_payout_reference ?? '']);
  csv += csvRow(['Requested By', p.requested_by]);
  csv += csvRow(['Approved By', p.approved_by ?? '']);
  csv += csvRow(['Submitted At', p.submitted_at ?? '']);
  csv += csvRow(['Completed At', p.completed_at ?? '']);
  if (p.reversed_at) {
    csv += csvRow(['Reversed At', p.reversed_at]);
    csv += csvRow(['Reversal Reason', p.reversal_reason ?? '']);
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${p.payout_reference}-confirmation.csv"`,
    },
  });
}
