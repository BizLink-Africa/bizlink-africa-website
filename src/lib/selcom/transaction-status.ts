import 'server-only';
import { selcomRequest } from './client';
import { SelcomValidationError } from './errors';
import type { OrderedFields, SelcomApiResult, TransactionStatusData, TransactionStatusRequest } from './types';

// GET /v1/transaction/query — read-only, idempotent status check. Safe to
// retry, unlike the disbursement it's checking on.
export async function queryTransactionStatus(
  request: TransactionStatusRequest,
  correlationId?: string
): Promise<SelcomApiResult<TransactionStatusData>> {
  if (!request.transId.trim()) {
    throw new SelcomValidationError('transId is required to query transaction status.', correlationId);
  }

  const fields: OrderedFields = [['transId', request.transId]];

  return selcomRequest<TransactionStatusData>({
    method: 'GET',
    path: '/v1/transaction/query',
    fields,
    retry: true,
    correlationId,
  });
}
