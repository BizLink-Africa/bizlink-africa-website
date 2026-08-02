// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateStatementPdfBuffer } from './generate-pdf';
import type { MerchantStatement } from '@/data/statements';

const sampleStatement: MerchantStatement = {
  statementPeriodStart: '2026-08-01',
  statementPeriodEnd: '2026-08-31',
  merchantId: 'merchant-1',
  merchantName: 'Sample Merchant Ltd',
  merchantReference: 'PMR-001',
  tillReference: 'TILL-001',
  openingUnsettledBalance: 0,
  transactionCount: 3,
  grossCollections: 100000,
  providerFees: 1000,
  bizlinkCommission: 2000,
  adjustments: 0,
  reversals: 0,
  chargebacks: 0,
  netSettlement: 97000,
  paidThisPeriod: 0,
  payoutReference: null,
  settlementDestinationMasked: '****1234',
  closingUnsettledBalance: 97000,
};

describe('generateStatementPdfBuffer — server-side PDF generation', () => {
  it('produces a real PDF file (starts with the %PDF magic bytes)', async () => {
    const buffer = await generateStatementPdfBuffer(sampleStatement);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('produces a non-trivial byte stream, not an empty document', async () => {
    const buffer = await generateStatementPdfBuffer(sampleStatement);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('never throws on a statement with null optional fields', async () => {
    const minimal: MerchantStatement = { ...sampleStatement, merchantReference: null, tillReference: null, payoutReference: null, settlementDestinationMasked: null };
    await expect(generateStatementPdfBuffer(minimal)).resolves.toBeInstanceOf(Buffer);
  });
});
