import 'server-only';
import { selcomRequest } from './client';
import { getSelcomConfig } from './config';
import type { BalanceData, BalanceWireData, OrderedFields, SelcomApiResult } from './types';

// POST /v1/balance — read-only, idempotent. Safe to retry (see client.ts's
// withRetry — only network/timeout/503 failures are ever retried).
//
// Requests the raw (snake_case) wire shape and maps it to the camelCase
// BalanceData the rest of the app consumes — see BalanceWireData's doc
// comment in types.ts for why this mapping step exists only for this one
// endpoint.
export async function getAccountBalance(accountNumber?: string, correlationId?: string): Promise<SelcomApiResult<BalanceData>> {
  const config = getSelcomConfig();
  const fields: OrderedFields = [['account_number', accountNumber ?? config.disbursementAccount]];

  const result = await selcomRequest<BalanceWireData>({
    method: 'POST',
    path: '/v1/balance',
    fields,
    retry: true,
    correlationId,
  });

  return {
    ...result,
    data: {
      accountNumber: result.data.account_number,
      currency: result.data.currency,
      availableBalance: result.data.available_balance,
      active: result.data.active,
    },
  };
}
