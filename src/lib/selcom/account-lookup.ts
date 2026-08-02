import 'server-only';
import { selcomRequest } from './client';
import { isValidMoneyString } from '@/lib/collections/money';
import { SelcomValidationError } from './errors';
import type { AccountLookupData, AccountLookupRequest, OrderedFields, SelcomApiResult } from './types';

// GET /v1/account/lookup — recipient verification before a transfer.
// Read-only, idempotent: safe to retry.
export async function lookupRecipientAccount(
  request: AccountLookupRequest,
  correlationId?: string
): Promise<SelcomApiResult<AccountLookupData>> {
  if (!request.bank.trim()) throw new SelcomValidationError('bank is required for an account lookup.', correlationId);
  if (!request.account.trim()) throw new SelcomValidationError('account is required for an account lookup.', correlationId);
  if (!request.transId.trim()) throw new SelcomValidationError('transId is required for an account lookup.', correlationId);
  if (request.amount !== undefined && !isValidMoneyString(request.amount)) {
    throw new SelcomValidationError('amount must be a valid decimal string (up to 2 decimal places).', correlationId);
  }

  const fields: Array<[string, string | number]> = [
    ['bank', request.bank],
    ['account', request.account],
    ['transId', request.transId],
  ];
  if (request.amount !== undefined) {
    fields.push(['amount', Number(request.amount)]);
  }

  return selcomRequest<AccountLookupData>({
    method: 'GET',
    path: '/v1/account/lookup',
    fields: fields as OrderedFields,
    retry: true,
    correlationId,
  });
}
