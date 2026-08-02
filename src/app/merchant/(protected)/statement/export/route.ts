import { NextResponse } from 'next/server';
import { requireActiveMerchant, verifyMerchantSession } from '@/lib/supabase/merchant-dal';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAuditEvent } from '@/lib/audit';
import { csvRow, csvResponseHeaders } from '@/lib/reports/csv';
import { generateStatementPdfBuffer } from '@/lib/statements/generate-pdf';
import type { MerchantStatement } from '@/data/statements';

// Self-service export — always scoped to the signed-in merchant's own
// merchant_id, never a client-supplied value. "Log every export" applies
// here exactly as it does on the admin side.
export async function GET(request: Request) {
  const merchant = await requireActiveMerchant();
  const user = await verifyMerchantSession();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_merchant_statement', {
    p_merchant_id: merchant.merchantId,
    p_period_start: from,
    p_period_end: to,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to generate statement' }, { status: 400 });
  }
  const statement = data as MerchantStatement;

  // audit_logs INSERT is gated by is_active_staff() — a merchant session
  // client would be rejected by RLS here, so this goes through the
  // service-role client (same pattern as the terms-acceptance action).
  const serviceClient = createServiceClient();
  await logAuditEvent({
    performedBy: user.email ?? merchant.fullName,
    actionType: `export_statement_${format}`,
    module: 'merchant_statements',
    recordId: merchant.merchantId,
    newValue: { from, to, format, selfService: true },
    client: serviceClient,
  });

  const filenameBase = `statement-${from}-to-${to}`;

  if (format === 'pdf') {
    const pdfBuffer = await generateStatementPdfBuffer(statement);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  }

  let csv = csvRow(['Merchant Statement']);
  csv += csvRow(['Merchant', statement.merchantName]);
  csv += csvRow(['Period', `${statement.statementPeriodStart} to ${statement.statementPeriodEnd}`]);
  csv += '\r\n';
  csv += csvRow(['Opening Unsettled Balance', statement.openingUnsettledBalance]);
  csv += csvRow(['Gross Collections', statement.grossCollections]);
  csv += csvRow(['Provider / Processing Fees', statement.providerFees]);
  csv += csvRow(['BizLink Commission & Service Fees', statement.bizlinkCommission]);
  csv += csvRow(['Adjustments', statement.adjustments]);
  csv += csvRow(['Reversals', statement.reversals]);
  csv += csvRow(['Chargebacks (Lost)', statement.chargebacks]);
  csv += csvRow(['Net Settlement', statement.netSettlement]);
  csv += csvRow(['Paid Out This Period', statement.paidThisPeriod]);
  csv += csvRow(['Closing Unsettled Balance', statement.closingUnsettledBalance]);
  csv += csvRow(['Payout Reference', statement.payoutReference ?? '']);
  csv += csvRow(['Settlement Destination (Masked)', statement.settlementDestinationMasked ?? '']);

  return new NextResponse(csv, { headers: csvResponseHeaders(`${filenameBase}.csv`) });
}
