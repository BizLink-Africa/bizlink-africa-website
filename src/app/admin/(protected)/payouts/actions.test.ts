// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequirePermission = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockHasRecentReauth = vi.fn();
vi.mock('@/lib/supabase/reauth', () => ({
  hasRecentReauth: (...args: unknown[]) => mockHasRecentReauth(...args),
  PAYOUT_REAUTH_PURPOSE: 'payout_approval',
}));

const mockGetAccountBalance = vi.fn();
vi.mock('@/lib/selcom/balance', () => ({
  getAccountBalance: (...args: unknown[]) => mockGetAccountBalance(...args),
}));

const mockQueryTransactionStatus = vi.fn();
vi.mock('@/lib/selcom/transaction-status', () => ({
  queryTransactionStatus: (...args: unknown[]) => mockQueryTransactionStatus(...args),
}));

const mockInitiateDisbursement = vi.fn();
vi.mock('@/lib/selcom/transaction-process', () => ({
  initiateDisbursement: (...args: unknown[]) => mockInitiateDisbursement(...args),
}));

process.env.BENEFICIARY_ENCRYPTION_KEY = 'test-encryption-key';

const PAYOUT_FIXTURE = {
  id: 'payout-1',
  payout_reference: 'PAY-2026-0001',
  idempotency_key: 'PAYOUT-abc123',
  merchant_id: 'merchant-1',
  beneficiary_id: 'beneficiary-1',
  destination_type: 'bank_account',
  amount: '97000.00',
  currency: 'TZS',
  status: 'approved',
  retry_count: 0,
  provider_payout_reference: null,
};

const BENEFICIARY_FIXTURE = {
  masked_destination_value: '****1234',
  destination_type: 'bank_account',
  account_holder_name: 'Jane Merchant',
  bank_or_network_code: 'CRDB',
  verification_status: 'verified',
};

const mockRpc = vi.fn();
const mockCreateClient = vi.fn();

function makeSupabase() {
  return {
    rpc: mockRpc,
    from: (table: string) => {
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        maybeSingle: () => {
          if (table === 'merchant_payouts') {
            return Promise.resolve({ data: PAYOUT_FIXTURE, error: null });
          }
          if (table === 'merchant_settlement_beneficiaries') {
            return Promise.resolve({ data: BENEFICIARY_FIXTURE, error: null });
          }
          if (table === 'selcom_integration_settings') {
            return Promise.resolve({ data: { integration_enabled: true }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return b;
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const {
  createPayoutsForBatch,
  approvePayout,
  cancelPayout,
  submitPayout,
  retryPayout,
  placePayoutHold,
  reversePayout,
  checkPayoutProviderStatus,
} = await import('./actions');

function defaultRpcImpl(fnName: string) {
  if (fnName === 'decrypt_beneficiary_destination_for_payout') {
    return Promise.resolve({ data: '255700000000', error: null });
  }
  return Promise.resolve({ data: null, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ email: 'finance@example.com' });
  mockHasRecentReauth.mockResolvedValue(true);
  mockRpc.mockImplementation((fnName: string) => defaultRpcImpl(fnName));
  mockCreateClient.mockReturnValue(makeSupabase());
  mockGetAccountBalance.mockResolvedValue({ data: { accountNumber: '000', currency: 'TZS', availableBalance: 5_000_000, active: true }, correlationId: 'c', result: 'SUCCESS', resultCode: '000' });
  mockInitiateDisbursement.mockResolvedValue({
    data: { trans_id: 'PAY-2026-0001', selcom_receipt: 'RCPT-1', status: 'ACCEPTED', amount: 97000, currency: 'TZS' },
    result: 'SUCCESS',
    resultCode: '000',
    correlationId: 'c',
  });
  mockQueryTransactionStatus.mockResolvedValue({
    data: { transId: 'PAY-2026-0001', status: 'COMPLETED', amount: 97000, currency: 'TZS', selcomReceipt: 'RCPT-1', transDatetime: '', senderAccount: '', senderName: '' },
    result: 'SUCCESS',
    resultCode: '000',
    correlationId: 'c',
  });
});

describe('permission gating — every mutating action requires server-side permission', () => {
  it('createPayoutsForBatch requires payouts.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createPayoutsForBatch('batch-1');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('approvePayout requires payouts.approve', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await approvePayout('payout-1');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('cancelPayout requires payouts.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await cancelPayout('payout-1', 'a reason');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('submitPayout requires payouts.submit', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(false);
    expect(mockInitiateDisbursement).not.toHaveBeenCalled();
  });

  it('retryPayout requires payouts.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await retryPayout('payout-1');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('placePayoutHold requires payouts.hold', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await placePayoutHold('payout-1', 'a reason');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reversePayout requires payouts.approve', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await reversePayout('payout-1', 'a reason');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('re-authentication gating — real money movement cannot proceed on a stale session', () => {
  it('approvePayout is blocked without a recent re-auth', async () => {
    mockHasRecentReauth.mockResolvedValueOnce(false);
    const result = await approvePayout('payout-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/re-confirm your password/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('submitPayout is blocked without a recent re-auth, before ever calling Selcom', async () => {
    mockHasRecentReauth.mockResolvedValueOnce(false);
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/sandbox/i);
    expect(mockInitiateDisbursement).not.toHaveBeenCalled();
    expect(mockGetAccountBalance).not.toHaveBeenCalled();
  });

  it('reversePayout is blocked without a recent re-auth', async () => {
    mockHasRecentReauth.mockResolvedValueOnce(false);
    const result = await reversePayout('payout-1', 'a reason');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('checks the payout-specific reauth purpose, not the beneficiary one', async () => {
    await approvePayout('payout-1');
    expect(mockHasRecentReauth).toHaveBeenCalledWith('payout_approval');
  });
});

describe('reason-required validations', () => {
  it('cancelPayout rejects an empty reason before calling the RPC', async () => {
    const result = await cancelPayout('payout-1', '   ');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('placePayoutHold rejects an empty reason before calling the RPC', async () => {
    const result = await placePayoutHold('payout-1', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reversePayout rejects an empty reason before calling the RPC', async () => {
    const result = await reversePayout('payout-1', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('server-side error surfacing — every checklist violation from the DB is surfaced, never swallowed', () => {
  it('surfaces the retry-ceiling message from retry_merchant_payout', async () => {
    mockRpc.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'This payout has already reached the maximum of 3 retries' } }));
    const result = await retryPayout('payout-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('maximum of 3 retries');
  });

  it('surfaces a maker-checker violation from approve_merchant_payout', async () => {
    mockRpc.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: 'Maker-checker violation: the approver must be different from the requester' } }));
    const result = await approvePayout('payout-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Maker-checker violation');
  });

  it('audit-logs a successful approval, never logging a raw beneficiary value', async () => {
    const result = await approvePayout('payout-1');
    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'approve', module: 'merchant_payouts', recordId: 'payout-1' })
    );
    const call = mockLogAuditEvent.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toMatch(/\d{6,}/); // no long raw digit sequences (account/wallet numbers)
  });

  it('surfaces a duplicate-transId unique-constraint violation from create_merchant_payouts_for_batch', async () => {
    mockRpc.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint "merchant_payouts_payout_reference_key"' } })
    );
    const result = await createPayoutsForBatch('batch-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/payout_reference/i);
  });

  it('surfaces a duplicate-idempotency-key unique-constraint violation from create_merchant_payouts_for_batch', async () => {
    mockRpc.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint "merchant_payouts_idempotency_key_key"' } })
    );
    const result = await createPayoutsForBatch('batch-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/idempotency_key/i);
  });

  it('surfaces begin_merchant_payout_submission checklist failures (e.g. unverified beneficiary) without calling Selcom', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'begin_merchant_payout_submission') {
        return Promise.resolve({ data: null, error: { message: "This payout's beneficiary is not currently verified and cannot be submitted" } });
      }
      return defaultRpcImpl(fnName);
    });
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not currently verified/i);
    expect(mockInitiateDisbursement).not.toHaveBeenCalled();
  });
});

describe('submitPayout — real Selcom sandbox integration, orchestration', () => {
  it('checks the Selcom integration kill switch before doing anything else', async () => {
    mockCreateClient.mockReturnValue({
      rpc: mockRpc,
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve(table === 'selcom_integration_settings' ? { data: { integration_enabled: false }, error: null } : { data: null, error: null }),
          }),
        }),
      }),
    });
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/disabled/i);
    expect(mockInitiateDisbursement).not.toHaveBeenCalled();
  });

  it('checks balance, begins submission, decrypts the destination, submits once, and applies the result', async () => {
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(true);
    expect(mockGetAccountBalance).toHaveBeenCalledTimes(1);
    expect(mockInitiateDisbursement).toHaveBeenCalledTimes(1);

    const rpcCalls = mockRpc.mock.calls.map((c) => c[0]);
    expect(rpcCalls).toContain('begin_merchant_payout_submission');
    expect(rpcCalls).toContain('decrypt_beneficiary_destination_for_payout');
    expect(rpcCalls).toContain('apply_merchant_payout_result');
  });

  it('sends purpose FT and the beneficiary institution code, never an invented debit-account field', async () => {
    await submitPayout('payout-1');
    const call = mockInitiateDisbursement.mock.calls[0][0];
    expect(call.purpose).toBe('FT');
    expect(call.recipientFiCode).toBe('CRDB');
    expect(call.transId).toBe('PAY-2026-0001');
    expect(call).not.toHaveProperty('senderAccount');
    expect(call).not.toHaveProperty('debitAccount');
  });

  it('never includes the raw decrypted account number in the audit log or the action return value', async () => {
    const result = await submitPayout('payout-1');
    expect(JSON.stringify(result)).not.toContain('255700000000');
    for (const call of mockLogAuditEvent.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain('255700000000');
    }
  });

  it('insufficient available balance blocks submission before Selcom is ever called', async () => {
    mockGetAccountBalance.mockResolvedValueOnce({
      data: { accountNumber: '000', currency: 'TZS', availableBalance: 100, active: true },
      correlationId: 'c',
      result: 'SUCCESS',
      resultCode: '000',
    });
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/insufficient/i);
    expect(mockInitiateDisbursement).not.toHaveBeenCalled();
  });

  it('a Selcom ACCEPTED response leaves the payout processing, never marked successful', async () => {
    mockInitiateDisbursement.mockResolvedValueOnce({
      data: { trans_id: 'PAY-2026-0001', selcom_receipt: 'RCPT-1', status: 'ACCEPTED', amount: 97000, currency: 'TZS' },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'c',
    });
    await submitPayout('payout-1');
    const applyCall = mockRpc.mock.calls.find((c) => c[0] === 'apply_merchant_payout_result');
    expect(applyCall?.[1]).toMatchObject({ p_status: 'processing' });
  });

  it('a Selcom COMPLETED response marks the payout successful', async () => {
    mockInitiateDisbursement.mockResolvedValueOnce({
      data: { trans_id: 'PAY-2026-0001', selcom_receipt: 'RCPT-1', status: 'COMPLETED', amount: 97000, currency: 'TZS' },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'c',
    });
    await submitPayout('payout-1');
    const applyCall = mockRpc.mock.calls.find((c) => c[0] === 'apply_merchant_payout_result');
    expect(applyCall?.[1]).toMatchObject({ p_status: 'successful' });
  });

  it('a network timeout calling Selcom is recorded as a failed result, never thrown, never silently retried', async () => {
    mockInitiateDisbursement.mockRejectedValueOnce(new Error('Selcom request to /v1/transaction/process timed out after 15000ms'));
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(true); // the ACTION succeeds — it always applies *some* result
    expect(mockInitiateDisbursement).toHaveBeenCalledTimes(1); // never retried automatically
    const applyCall = mockRpc.mock.calls.find((c) => c[0] === 'apply_merchant_payout_result');
    expect(applyCall?.[1]).toMatchObject({ p_status: 'failed' });
  });
});

describe('checkPayoutProviderStatus — requires payouts.view, syncs a confirmed result', () => {
  it('requires payouts.view', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await checkPayoutProviderStatus('payout-1');
    expect(result.success).toBe(false);
  });
});
