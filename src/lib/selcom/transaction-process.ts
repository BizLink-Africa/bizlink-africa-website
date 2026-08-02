import 'server-only';
import { selcomRequest } from './client';
import { getSelcomConfig } from './config';
import { isSelcomIntegrationEnabledByEnv, isSelcomLivePayoutsEnabledByEnv } from './env';
import { isValidMoneyString } from '@/lib/collections/money';
import { SelcomConfigError, SelcomValidationError } from './errors';
import type { OrderedFields, SelcomApiResult, TransactionProcessData, TransactionProcessRequest } from './types';

// POST /v1/transaction/process — initiates a real disbursement. This is the
// one call in this integration that moves money, so it carries independent
// safety properties on top of everything client.ts already provides:
//
//   1. Two deployment-level env-var gates, checked here explicitly (not
//      just inherited from config.ts) so both are visible at the one call
//      site that actually matters:
//        a. SELCOM_INTEGRATION_ENABLED must be "true" — required for
//           EVERY environment (sandbox included). Independent of, and in
//           addition to, the DB-backed integration_enabled kill switch
//           (Administration -> Integrations -> Disbursement API) — this
//           one can only be changed by a deployment env-var change, never
//           from the admin UI, so it survives a compromised admin session.
//        b. SELCOM_LIVE_PAYOUTS_ENABLED must ALSO be "true" — but only
//           required when the resolved environment is 'production'.
//           Sandbox never moves real funds, so it never needs this flag.
//           This must remain unset/false in every environment until the
//           full Production Readiness checklist and Finance + Compliance
//           approval are recorded (Administration -> Integrations ->
//           Disbursement API -> Production Readiness) AND a deliberate,
//           separate deployment decision enables it.
//   2. It is never eligible for automatic retry — `retry` is simply not a
//      parameter this function can pass through to selcomRequest(). A
//      timed-out or network-failed initiateDisbursement() call must never
//      silently fire a second real disbursement attempt. Retrying a failed
//      payout is a deliberate, human-triggered action elsewhere in this
//      codebase (see retry_merchant_payout() / src/lib/payouts/
//      disbursement-adapter.ts's idempotency contract) — never automatic
//      here.
export async function initiateDisbursement(
  request: TransactionProcessRequest,
  correlationId?: string
): Promise<SelcomApiResult<TransactionProcessData>> {
  const config = getSelcomConfig();

  if (!isSelcomIntegrationEnabledByEnv()) {
    throw new SelcomConfigError(
      'Refusing to initiate a disbursement: SELCOM_INTEGRATION_ENABLED is not set to "true" on this deployment.',
      correlationId
    );
  }
  if (config.env === 'production' && !isSelcomLivePayoutsEnabledByEnv()) {
    throw new SelcomConfigError(
      'Refusing to initiate a production disbursement: SELCOM_LIVE_PAYOUTS_ENABLED is not set to "true" — this is the final deployment-level safety gate for real fund movement, and must never be enabled without completed Production Readiness approval.',
      correlationId
    );
  }

  if (!request.transId.trim()) throw new SelcomValidationError('transId is required.', correlationId);
  if (!request.recipientFiCode.trim()) throw new SelcomValidationError('recipientFiCode is required.', correlationId);
  if (!request.recipientAccount.trim()) throw new SelcomValidationError('recipientAccount is required.', correlationId);
  if (!request.recipientName.trim()) throw new SelcomValidationError('recipientName is required.', correlationId);
  if (!isValidMoneyString(request.amount)) {
    throw new SelcomValidationError('amount must be a valid decimal string (up to 2 decimal places).', correlationId);
  }
  if (!request.purpose.trim()) throw new SelcomValidationError('purpose is required.', correlationId);

  const fields: Array<[string, string | number]> = [
    ['transId', request.transId],
    ['recipientFiCode', request.recipientFiCode],
    ['recipientAccount', request.recipientAccount],
    ['recipientName', request.recipientName],
    ['amount', Number(request.amount)],
    ['purpose', request.purpose],
  ];
  if (request.remarks) {
    fields.push(['remarks', request.remarks]);
  }

  return selcomRequest<TransactionProcessData>({
    method: 'POST',
    path: '/v1/transaction/process',
    fields: fields as OrderedFields,
    // No `retry` — see function doc comment above.
    correlationId,
  });
}
