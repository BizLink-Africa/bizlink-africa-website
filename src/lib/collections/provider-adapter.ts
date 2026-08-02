// Defines the shape a real payment-infrastructure-partner statement
// integration would eventually implement. No live API integration exists
// anywhere in this app yet, and fetchStatement() must never be wired to a
// real HTTP call without a separate, explicit decision to activate it —
// the only implementation provided is SandboxProviderAdapter (deterministic
// synthetic rows). The actually-used import path is manual CSV upload
// (see csv-parser.ts), not this interface at all — it exists so a future
// live integration has a settled shape to implement against.

export type ProviderMode = 'sandbox' | 'manual_import' | 'live';

export interface ProviderTransactionRow {
  providerTransactionReference: string;
  tillReference: string | null;
  payerReferenceMasked: string | null;
  // Decimal strings only, never a JS number — see money.ts.
  grossAmount: string;
  currency: string;
  providerFee: string;
  collectedAt: string; // ISO 8601
  transactionStatus: 'successful' | 'failed' | 'pending';
  reversalStatus?: 'none' | 'reversed' | 'pending_reversal';
  chargebackStatus?: 'none' | 'disputed' | 'chargeback_confirmed';
}

export interface CollectionProviderAdapter {
  readonly name: string;
  readonly mode: ProviderMode;
  fetchStatement(params: { from: string; to: string }): Promise<ProviderTransactionRow[]>;
}

// Sandbox mode: deterministic, obviously-synthetic rows for exercising the
// import → reconciliation → approval pipeline without any real provider
// connection or real merchant data. Never used for anything reconciliation
// output is trusted for in production.
export class SandboxProviderAdapter implements CollectionProviderAdapter {
  readonly name = 'Sandbox';
  readonly mode: ProviderMode = 'sandbox';

  async fetchStatement(params: { from: string; to: string }): Promise<ProviderTransactionRow[]> {
    const collectedAt = new Date(`${params.from}T09:00:00.000Z`).toISOString();
    return [
      {
        providerTransactionReference: `SANDBOX-${params.from}-0001`,
        tillReference: null,
        payerReferenceMasked: '****0001',
        grossAmount: '1000.00',
        currency: 'TZS',
        providerFee: '10.00',
        collectedAt,
        transactionStatus: 'successful',
        reversalStatus: 'none',
        chargebackStatus: 'none',
      },
      {
        providerTransactionReference: `SANDBOX-${params.from}-0002`,
        tillReference: null,
        payerReferenceMasked: '****0002',
        grossAmount: '2500.50',
        currency: 'TZS',
        providerFee: '25.00',
        collectedAt,
        transactionStatus: 'successful',
        reversalStatus: 'none',
        chargebackStatus: 'none',
      },
    ];
  }
}
