// Mirrors the jsonb shape returned by generate_merchant_statement() —
// every figure here was computed in Postgres, never recomputed in TS.
// Numeric fields arrive as JS numbers (jsonb numeric, not text) since
// Postgres jsonb_build_object() emits them unquoted; they are used for
// display only (formatMoney), never as inputs to a further calculation —
// see src/lib/collections/money.ts for why that distinction matters.
export interface MerchantStatement {
  statementPeriodStart: string;
  statementPeriodEnd: string;
  merchantId: string;
  merchantName: string;
  merchantReference: string | null;
  tillReference: string | null;
  openingUnsettledBalance: number;
  transactionCount: number;
  grossCollections: number;
  providerFees: number;
  bizlinkCommission: number;
  adjustments: number;
  reversals: number;
  chargebacks: number;
  netSettlement: number;
  paidThisPeriod: number;
  payoutReference: string | null;
  settlementDestinationMasked: string | null;
  closingUnsettledBalance: number;
}
