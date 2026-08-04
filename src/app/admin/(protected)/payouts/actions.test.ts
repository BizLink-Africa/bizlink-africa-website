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
  releasePayoutHold,
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

// Merchant payouts are not handled by BizLink Africa — settlement happens
// directly between each merchant and their approved payment partner.
// BizLink Africa does not manage merchant settlement (see
// BIZLINK_MANAGES_MERCHANT_SETTLEMENTS in
// src/lib/archived-financial-prototype.ts). Every payout-creation/approval/
// submission/retry/cancellation/hold/reversal action in ./actions.ts calls
// assertMerchantSettlementsNotBizLinkManaged() as its very first statement,
// so every one of them must fail unconditionally, before ever reaching a
// permission check, a re-authentication check, or the RPC/Selcom layer —
// regardless of what the caller's permissions or re-auth state are. This
// also means the old "blocked without a recent re-auth" tests no longer
// make sense as written: the failure a caller now sees is always the
// merchant-payouts-not-handled message, never the re-auth prompt, because
// the guard fires first. checkPayoutProviderStatus is the one exception —
// see the dedicated describe block below — it's a read-only technical
// status check with no fund-movement effect, and is deliberately NOT
// gated by this guard (preserved non-financial integration support).
// See src/app/admin/(protected)/chargebacks/actions.test.ts for the
// sibling module this pattern was first applied to, and
// src/lib/archived-financial-prototype.ts for the guard itself.
describe('payouts are not handled by BizLink Africa — money-movement actions always blocked', () => {
  const cases: [string, () => Promise<{ success: boolean; message?: string }>][] = [
    ['createPayoutsForBatch', () => createPayoutsForBatch('batch-1')],
    ['approvePayout', () => approvePayout('payout-1')],
    ['cancelPayout', () => cancelPayout('payout-1', 'a reason')],
    ['submitPayout', () => submitPayout('payout-1')],
    ['retryPayout', () => retryPayout('payout-1')],
    ['placePayoutHold', () => placePayoutHold('payout-1', 'a reason')],
    ['releasePayoutHold', () => releasePayoutHold('payout-1', '')],
    ['reversePayout', () => reversePayout('payout-1', 'a reason')],
  ];

  for (const [name, action] of cases) {
    it(`${name} is permanently blocked, even when the caller has permission and a fresh re-auth`, async () => {
      const result = await action();
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'Merchant payouts are not handled by BizLink Africa. Settlement is managed directly by each merchant through the approved payment partner.'
      );
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockInitiateDisbursement).not.toHaveBeenCalled();
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  }

  it('never reaches the permission check either — a caller with no permission at all gets the same blocked message', async () => {
    mockRequirePermission.mockRejectedValue(new Error('no'));
    const result = await approvePayout('payout-1');
    expect(result.success).toBe(false);
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it('is blocked regardless of re-auth state — approvePayout fails the same way whether or not hasRecentReauth would have passed', async () => {
    mockHasRecentReauth.mockResolvedValueOnce(false);
    const resultWithoutReauth = await approvePayout('payout-1');
    mockHasRecentReauth.mockResolvedValueOnce(true);
    const resultWithReauth = await approvePayout('payout-1');
    expect(resultWithoutReauth.success).toBe(false);
    expect(resultWithReauth.success).toBe(false);
    expect(mockHasRecentReauth).not.toHaveBeenCalled();
  });

  it('submitPayout never checks the Selcom integration kill switch, balance, or calls Selcom at all — no live payout can be submitted', async () => {
    const result = await submitPayout('payout-1');
    expect(result.success).toBe(false);
    expect(mockGetAccountBalance).not.toHaveBeenCalled();
    expect(mockInitiateDisbursement).not.toHaveBeenCalled();
    expect(mockQueryTransactionStatus).not.toHaveBeenCalled();
  });

  it('direct invocation (bypassing any UI) is rejected identically — these are the actual server actions, there is no separate "API route" to go around', async () => {
    // Every action above is called directly here, exactly as a client
    // component (or any other direct caller, e.g. a crafted request to the
    // Next.js server-action endpoint) would invoke it. There is no code
    // path that reaches the RPC/Selcom layer.
    const results = await Promise.all(cases.map(([, action]) => action()));
    expect(results.every((r) => r.success === false)).toBe(true);
  });
});

// checkPayoutProviderStatus is deliberately NOT gated by
// assertMerchantSettlementsNotBizLinkManaged() — it's a read-only technical
// status check (never creates, approves, or moves a payout) and is
// explicitly preserved non-financial integration support, distinct from
// the money-movement actions above.
describe('checkPayoutProviderStatus — preserved read-only transaction-status viewing', () => {
  it('is not blocked by the merchant-settlements guard and still reaches Selcom\'s status-query endpoint', async () => {
    const result = await checkPayoutProviderStatus('payout-1');
    expect(result.success).toBe(true);
    expect(mockQueryTransactionStatus).toHaveBeenCalledWith({ transId: 'PAY-2026-0001' });
  });

  it('never calls initiateDisbursement or any other fund-movement path', async () => {
    await checkPayoutProviderStatus('payout-1');
    expect(mockInitiateDisbursement).not.toHaveBeenCalled();
  });

  it('still enforces payouts.view permission', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await checkPayoutProviderStatus('payout-1');
    expect(result.success).toBe(false);
    expect(mockQueryTransactionStatus).not.toHaveBeenCalled();
  });
});
