import 'server-only';
import PDFDocument from 'pdfkit';
import type { MerchantStatement } from '@/data/statements';

function formatTzs(value: number): string {
  return `TZS ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Server-only PDF generation — this file never runs in the browser (the
// "server-only" import enforces that at build time). Called exclusively
// from the export Route Handlers, which are the only place the resulting
// bytes are ever produced or returned.
export function generateStatementPdfBuffer(statement: MerchantStatement): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#00342b').text('BizLink Africa', { continued: false });
    doc.fontSize(12).fillColor('#3f4945').text('Merchant Settlement Statement');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#707975').text(
      `Period: ${statement.statementPeriodStart} to ${statement.statementPeriodEnd}`
    );
    doc.moveDown(1);

    doc.fontSize(11).fillColor('#1b1c1c');
    doc.text(`Merchant: ${statement.merchantName}`);
    doc.text(`Merchant Reference: ${statement.merchantReference ?? '—'}`);
    doc.text(`Till Reference: ${statement.tillReference ?? '—'}`);
    doc.moveDown(1);

    function row(label: string, value: string, bold = false) {
      doc.fontSize(10).fillColor('#3f4945');
      const y = doc.y;
      doc.text(label, 50, y, { width: 300 });
      doc.fontSize(10).fillColor(bold ? '#00342b' : '#1b1c1c').text(value, 350, y, { width: 195, align: 'right' });
      if (bold) doc.font('Helvetica-Bold');
      doc.moveDown(0.4);
      doc.font('Helvetica');
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#bfc9c4').stroke();
    doc.moveDown(0.5);

    row('Opening Unsettled Balance', formatTzs(statement.openingUnsettledBalance));
    row('Gross Collections', formatTzs(statement.grossCollections));
    row('Provider / Processing Fees', `(${formatTzs(statement.providerFees)})`);
    row('BizLink Commission & Service Fees', `(${formatTzs(statement.bizlinkCommission)})`);
    row('Adjustments', formatTzs(statement.adjustments));
    row('Reversals', `(${formatTzs(statement.reversals)})`);
    row('Chargebacks (Lost)', `(${formatTzs(statement.chargebacks)})`);

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#bfc9c4').stroke();
    doc.moveDown(0.3);

    row('Net Settlement (this period)', formatTzs(statement.netSettlement), true);
    row('Paid Out This Period', formatTzs(statement.paidThisPeriod));
    row('Closing Unsettled Balance', formatTzs(statement.closingUnsettledBalance), true);

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#bfc9c4').stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#3f4945');
    doc.text(`Payout Reference: ${statement.payoutReference ?? '—'}`);
    doc.text(`Settlement Destination: ${statement.settlementDestinationMasked ?? '—'}`);
    doc.text(`Transactions in Period: ${statement.transactionCount}`);

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#707975').text(
      `Generated ${new Date().toISOString()} — figures computed server-side from the ledger. This statement does not disclose partner processing rates.`,
      { width: 495 }
    );

    doc.end();
  });
}
