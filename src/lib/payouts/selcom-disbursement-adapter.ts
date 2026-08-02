import 'server-only';
import { initiateDisbursement } from '@/lib/selcom/transaction-process';
import { queryTransactionStatus } from '@/lib/selcom/transaction-status';
import { isSelcomError } from '@/lib/selcom/errors';
import { mapSelcomTransactionStatus } from './selcom-status-mapping';
import type {
  DisbursementAdapter,
  DisbursementAdapterMode,
  DisbursementRequest,
  DisbursementResult,
  BeneficiaryValidationRequest,
  BeneficiaryValidationResult,
  WebhookVerificationResult,
} from './disbursement-adapter';

// Real Selcom Business sandbox Transaction Process integration
// (POST /v1/transaction/process, GET /v1/transaction/query). Can never
// reach Selcom's production endpoint — src/lib/selcom/config.ts
// structurally refuses to build a config for SELCOM_ENV=production, and
// src/lib/selcom/transaction-process.ts's initiateDisbursement() adds its
// own independent sandbox-only guard on top of that.
//
// Purpose code: this app always sends purpose 'FT' ("Funds transfer" —
// confirmed against developer.selcom.business's documented purpose-code
// table). The documentation does not single out any code as specifically
// for merchant settlement/beneficiary payouts; of the 47 documented codes,
// FT is the only one that generically and accurately describes what a
// merchant settlement payout actually is (BizLink transferring funds it
// holds to a merchant's registered beneficiary account) — not a purchase,
// bill, salary, or any of the other categorised codes.
//
// Debit account: never sent as a request field. The documented
// /v1/transaction/process payload has no sender/debit-account field at
// all (transId, recipientFiCode, recipientAccount, recipientName, amount,
// purpose, remarks only) — the account actually debited is resolved by
// Selcom from the authenticated API credentials themselves, exactly as
// documented. Inventing a debit-account request field would be exactly
// the kind of undocumented-field invention this integration must avoid.
export class SelcomDisbursementAdapter implements DisbursementAdapter {
  readonly name = 'Selcom';
  readonly mode: DisbursementAdapterMode = 'sandbox';

  async submitPayout(request: DisbursementRequest): Promise<DisbursementResult> {
    if (!request.beneficiaryId || !request.destinationType || !request.institutionCode || !request.recipientAccount || !request.recipientName) {
      return {
        status: 'failed',
        providerPayoutReference: null,
        failureCode: 'MISSING_BENEFICIARY',
        failureReason: 'No verified beneficiary/destination on file for this payout.',
      };
    }

    try {
      const result = await initiateDisbursement({
        transId: request.payoutReference,
        recipientFiCode: request.institutionCode,
        recipientAccount: request.recipientAccount,
        recipientName: request.recipientName,
        amount: request.amount,
        purpose: 'FT',
        remarks: request.remarks,
      });

      const mapped = mapSelcomTransactionStatus(result.data.status);
      return {
        status: mapped,
        providerPayoutReference: result.data.selcom_receipt || result.data.trans_id || null,
        failureCode: mapped === 'failed' ? 'SELCOM_REPORTED_FAILED' : null,
        failureReason: mapped === 'failed' ? `Selcom reported status: ${result.data.status}` : null,
        rawResponse: { result: result.result, resultCode: result.resultCode, data: result.data },
      };
    } catch (err) {
      // Never swallow the real error silently — an UNKNOWN_ERROR failure
      // code with no server-side trace is undiagnosable. isSelcomError
      // errors are already descriptive via failureReason; anything else
      // (a genuine bug) needs its full detail logged server-side, never
      // just a generic message returned to the UI.
      if (!isSelcomError(err)) {
        console.error('[selcom] submitPayout — unexpected non-Selcom error', err);
      }
      const failureReason = isSelcomError(err) ? err.message : 'Selcom disbursement request failed.';
      return {
        status: 'failed',
        providerPayoutReference: null,
        failureCode: isSelcomError(err) ? err.code : 'UNKNOWN_ERROR',
        failureReason,
        rawResponse: null,
      };
    }
  }

  // Used both for the manual "Check Provider Status" action and, more
  // importantly, as the controlled retry workflow's first step — see
  // submitPayout() in src/app/admin/(protected)/payouts/actions.ts, which
  // queries by transId (the payout's own payout_reference) before ever
  // resubmitting a payout that previously failed or timed out, so a retry
  // can never produce a duplicate real disbursement.
  //
  // Deliberately does NOT catch query failures into a fake 'failed'
  // DisbursementResult — confirmed live against Selcom's sandbox that a
  // transaction can 404 on /v1/transaction/query for a short window
  // immediately after /v1/transaction/process accepted it (eventual
  // consistency, not a real failure). Conflating "the status check itself
  // failed" with "Selcom says the transaction failed" would let a caller
  // silently downgrade a genuinely in-progress or successful payout to
  // 'failed', which is exactly the kind of mistake that could lead an
  // operator to retry — and risk duplicating — a payout that actually
  // went through. A query failure is thrown as-is; only a SUCCESSFUL
  // query result is ever translated into a DisbursementResult.
  async getPayoutStatus(providerPayoutReference: string): Promise<DisbursementResult> {
    const result = await queryTransactionStatus({ transId: providerPayoutReference });
    const mapped = mapSelcomTransactionStatus(result.data.status);
    return {
      status: mapped,
      providerPayoutReference: result.data.selcomReceipt || providerPayoutReference,
      failureCode: mapped === 'failed' ? 'SELCOM_REPORTED_FAILED' : null,
      failureReason: mapped === 'failed' ? `Selcom reported status: ${result.data.status}` : null,
      rawResponse: { result: result.result, resultCode: result.resultCode, data: result.data },
    };
  }

  // No live account-lookup call here by design — this adapter method
  // exists to satisfy the DisbursementAdapter interface for the
  // pre-submission validation seam; the actual Selcom account-lookup
  // integration lives in the Merchant Beneficiaries module
  // (src/lib/selcom/account-lookup.ts) and runs separately, well before a
  // payout ever reaches submission. Here, we only confirm a masked
  // destination value is actually on file.
  async validateBeneficiary(request: BeneficiaryValidationRequest): Promise<BeneficiaryValidationResult> {
    if (!request.maskedDestinationValue || request.maskedDestinationValue === '—') {
      return { valid: false, reason: 'No destination value on file.' };
    }
    return { valid: true, reason: null };
  }

  // Selcom's inbound callback authentication scheme has not been
  // confirmed against this account's documentation/dashboard — honest
  // about that rather than pretending to verify, same convention as
  // SandboxDisbursementAdapter.verifyWebhook().
  async verifyWebhook(_payload: string, _signature: string | null): Promise<WebhookVerificationResult> {
    return {
      valid: false,
      payoutReference: null,
      reason: 'Selcom callback verification is not yet implemented — the signing scheme has not been confirmed for this account.',
    };
  }
}
