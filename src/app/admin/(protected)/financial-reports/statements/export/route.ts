import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { csvRow, csvResponseHeaders } from '@/lib/reports/csv';
import { generateStatementPdfBuffer } from '@/lib/statements/generate-pdf';
import type { MerchantStatement } from '@/data/statements';

// "Statements must be generated server-side" / "Log every export" — this
// Route Handler is the only place a statement is ever turned into a
// downloadable file, and it is the one place the export gets audit-logged.
export async function GET(request: Request) {
  let user;
  try {
    user = await requirePermission('financial_reports.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchant');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';

  if (!merchantId || !from || !to) {
    return NextResponse.json({ error: 'merchant, from and to are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_merchant_statement', {
    p_merchant_id: merchantId,
    p_period_start: from,
    p_period_end: to,
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to generate statement' }, { status: 400 });
  }
  const statement = data as MerchantStatement;

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `export_statement_${format}`,
    module: 'merchant_statements',
    recordId: merchantId,
    newValue: { from, to, format },
  });

  const filenameBase = `statement-${statement.merchantReference ?? merchantId}-${from}-to-${to}`;

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
  csv += csvRow(['Merchant Reference', statement.merchantReference ?? '']);
  csv += csvRow(['Till Reference', statement.tillReference ?? '']);
  csv += csvRow(['Period', `${statement.statementPeriodStart} to ${statement.statementPeriodEnd}`]);
  csv += csvRow(['Transaction Count', statement.transactionCount]);
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
  csv += '\r\n';
  csv += csvRow(['Payout Reference', statement.payoutReference ?? '']);
  csv += csvRow(['Settlement Destination (Masked)', statement.settlementDestinationMasked ?? '']);

  return new NextResponse(csv, { headers: csvResponseHeaders(`${filenameBase}.csv`) });
}
