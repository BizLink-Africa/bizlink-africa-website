// Generic disbursement provider adapter interface. Two implementations
// exist: SandboxDisbursementAdapter (a fully local, deterministic mock —
// never makes a network call) and SelcomDisbursementAdapter
// (src/lib/payouts/selcom-disbursement-adapter.ts — calls Selcom's real
// sandbox Transaction Process API over HTTPS, signed, against
// developer.selcom.business's documented shape). Neither can ever reach
// Selcom's production endpoint: src/lib/selcom/config.ts structurally
// refuses to build a config for SELCOM_ENV=production.
//
// SelcomDisbursementAdapter:
//   - sources all credentials from server-only environment variables
//     (src/lib/selcom/config.ts), never hardcoded or sent to the browser
//   - honours idempotencyKey/payoutReference so a retried submitPayout()
//     call can never result in two real disbursements — see
//     src/app/admin/(protected)/payouts/actions.ts's retry handling, which
//     queries Selcom for an existing transId's status before ever
//     resubmitting
//   - verifyWebhook() is still a documented non-implementation (Selcom's
//     callback signature scheme was not confirmed against this account's
//     dashboard) — it must never be a no-op that returns valid: true
//   - never logs a raw beneficiary destination value (account number,
//     wallet number) — only the masked form already computed elsewhere
//     (see src/lib/security/mask.ts)

export type DisbursementAdapterMode = 'sandbox' | 'live';

export type DisbursementDestinationType = 'bank_account' | 'mobile_wallet';

// 'unknown' — the provider responded, but with a status this app doesn't
// recognise (see src/lib/payouts/selcom-status-mapping.ts, the single
// central place that decides what maps to what). Distinct from a thrown
// error (query/request failed outright): this means we DID get an answer,
// it just wasn't one of the documented ones.
export type DisbursementStatus = 'processing' | 'successful' | 'failed' | 'unknown';

export interface DisbursementRequest {
  payoutId: string;
  // The internal payout reference (merchant_payouts.payout_reference,
  // already unique) — reused as Selcom's transId by a live adapter. The
  // sandbox mock adapter ignores it.
  payoutReference: string;
  idempotencyKey: string;
  merchantId: string;
  beneficiaryId: string | null;
  destinationType: DisbursementDestinationType | null;
  // Selcom institution/destination code (e.g. 'CRDB', 'MPESA', 'SELCOM') —
  // required by a live adapter, sourced only from selcom_institution_codes
  // (see the Merchant Beneficiaries account-lookup integration). Optional
  // here so the sandbox mock's existing request shape still type-checks.
  institutionCode?: string | null;
  // The RAW destination account/wallet number, decrypted just-in-time by
  // the caller immediately before this call — never stored, logged, or
  // returned anywhere beyond this one request. Optional/nullable because
  // the sandbox mock never needs it (it never leaves this process).
  recipientAccount?: string | null;
  // Non-secret — the beneficiary's on-file account holder name.
  recipientName?: string | null;
  remarks?: string;
  // Decimal string only, never a JS number — see src/lib/collections/money.ts.
  amount: string;
  currency: string;
}

export interface DisbursementResult {
  status: DisbursementStatus;
  providerPayoutReference: string | null;
  failureCode: string | null;
  failureReason: string | null;
  // The raw provider response envelope, for storage only (requirement:
  // "save initial response, Selcom receipt, API status"). Never contains a
  // secret — Selcom's documented response shape is
  // success/error_code/message/data/result/resultcode, none of which
  // echoes back a credential. Undefined for SandboxDisbursementAdapter,
  // which has no real envelope to report.
  rawResponse?: Record<string, unknown> | null;
}

export interface BeneficiaryValidationRequest {
  destinationType: DisbursementDestinationType;
  // Only ever the already-masked form (e.g. "****1234") — this interface
  // must never be passed a raw account/wallet number.
  maskedDestinationValue: string;
}

export interface BeneficiaryValidationResult {
  valid: boolean;
  reason: string | null;
}

export interface WebhookVerificationResult {
  valid: boolean;
  payoutReference: string | null;
  reason: string | null;
}

export interface DisbursementAdapter {
  readonly name: string;
  readonly mode: DisbursementAdapterMode;
  submitPayout(request: DisbursementRequest): Promise<DisbursementResult>;
  getPayoutStatus(providerPayoutReference: string): Promise<DisbursementResult>;
  validateBeneficiary(request: BeneficiaryValidationRequest): Promise<BeneficiaryValidationResult>;
  verifyWebhook(payload: string, signature: string | null): Promise<WebhookVerificationResult>;
}

// Sandbox mode: never calls any external service. Deterministic and safe
// to call repeatedly with the same idempotencyKey — always returns the
// same synthetic reference for a given key, which is the property a real
// adapter's idempotency handling must also guarantee.
export class SandboxDisbursementAdapter implements DisbursementAdapter {
  readonly name = 'Sandbox';
  readonly mode: DisbursementAdapterMode = 'sandbox';

  async submitPayout(request: DisbursementRequest): Promise<DisbursementResult> {
    if (!request.beneficiaryId || !request.destinationType) {
      return {
        status: 'failed',
        providerPayoutReference: null,
        failureCode: 'MISSING_BENEFICIARY',
        failureReason: 'No verified beneficiary/destination on file for this payout.',
      };
    }
    const providerPayoutReference = `SANDBOX-DISB-${request.idempotencyKey}`;
    return { status: 'successful', providerPayoutReference, failureCode: null, failureReason: null };
  }

  async getPayoutStatus(providerPayoutReference: string): Promise<DisbursementResult> {
    if (!providerPayoutReference.startsWith('SANDBOX-DISB-')) {
      return { status: 'failed', providerPayoutReference, failureCode: 'UNKNOWN_REFERENCE', failureReason: 'Reference not recognised by the sandbox adapter.' };
    }
    return { status: 'successful', providerPayoutReference, failureCode: null, failureReason: null };
  }

  async validateBeneficiary(request: BeneficiaryValidationRequest): Promise<BeneficiaryValidationResult> {
    if (!request.maskedDestinationValue || request.maskedDestinationValue === '—') {
      return { valid: false, reason: 'No destination value on file.' };
    }
    return { valid: true, reason: null };
  }

  // Sandbox mode has no real signing key to verify against, so this is
  // honest about that rather than pretending to validate — it always
  // reports invalid rather than silently trusting an unverified payload.
  async verifyWebhook(_payload: string, _signature: string | null): Promise<WebhookVerificationResult> {
    return { valid: false, payoutReference: null, reason: 'Sandbox mode has no live webhook signing key configured — nothing to verify against.' };
  }
}
