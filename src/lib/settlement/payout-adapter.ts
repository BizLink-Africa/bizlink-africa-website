// Defines the shape a real payout/disbursement partner integration would
// eventually implement. No live payout execution exists anywhere in this
// app yet, and payOut() must never be wired to a real transfer API without
// a separate, explicit decision to activate it. The only implementation
// provided is SandboxPayoutAdapter (deterministic, always-succeeds unless
// explicitly told to simulate a failure) — used purely to exercise the
// approve -> process -> completed pipeline without moving real money.

export type PayoutAdapterMode = 'sandbox' | 'live';

export interface PayoutRequest {
  batchId: string;
  lineId: string;
  merchantId: string;
  beneficiaryId: string | null;
  // Decimal string only, never a JS number — see src/lib/collections/money.ts.
  amount: string;
  currency: string;
}

export interface PayoutResult {
  lineId: string;
  status: 'paid' | 'failed';
  payoutReference: string | null;
  failureReason: string | null;
}

export interface PayoutAdapter {
  readonly name: string;
  readonly mode: PayoutAdapterMode;
  payOut(request: PayoutRequest): Promise<PayoutResult>;
}

// Sandbox mode: never calls any external service. Succeeds deterministically
// for every line unless the destination has no verified beneficiary on
// file, in which case it fails with a clear reason — a close analogue of
// the real failure a live adapter would report for a missing/invalid
// destination account.
export class SandboxPayoutAdapter implements PayoutAdapter {
  readonly name = 'Sandbox';
  readonly mode: PayoutAdapterMode = 'sandbox';

  async payOut(request: PayoutRequest): Promise<PayoutResult> {
    if (!request.beneficiaryId) {
      return {
        lineId: request.lineId,
        status: 'failed',
        payoutReference: null,
        failureReason: 'No verified beneficiary on file for this merchant.',
      };
    }
    return {
      lineId: request.lineId,
      status: 'paid',
      payoutReference: `SANDBOX-PAYOUT-${request.batchId.slice(0, 8)}-${request.lineId.slice(0, 8)}`,
      failureReason: null,
    };
  }
}
