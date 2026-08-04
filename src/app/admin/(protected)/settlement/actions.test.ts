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

const mockRefreshSelcomBalance = vi.fn();
vi.mock('@/lib/selcom/balance-service', () => ({
  refreshSelcomBalance: (...args: unknown[]) => mockRefreshSelcomBalance(...args),
}));

const mockRpc = vi.fn();
const mockCreateClient = vi.fn();

function makeSupabase() {
  return {
    rpc: mockRpc,
    from: (table: string) => {
      if (table === 'settlement_batch_lines') {
        // A thenable chain: .select().eq().eq() all return itself, and
        // awaiting it resolves via .then() — mirrors the real query shape
        // in processSettlementBatch() without needing a full PostgREST mock.
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          then: (resolve: (v: unknown) => void) =>
            resolve({
              data: [
                { id: 'line-1', merchant_id: 'merchant-1', beneficiary_id: 'beneficiary-1', net_amount: '1000.00' },
                { id: 'line-2', merchant_id: 'merchant-2', beneficiary_id: null, net_amount: '2000.00' },
              ],
              error: null,
            }),
        };
        return chain;
      }
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        maybeSingle: () => {
          if (table === 'settlement_batches') return Promise.resolve({ data: { id: 'batch-1' }, error: null });
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
  prepareSettlementBatch,
  submitSettlementBatchForReview,
  reviewSettlementBatch,
  rejectSettlementBatch,
  approveSettlementBatch,
  placeSettlementBatchHold,
  releaseSettlementBatchHold,
  emergencyCancelSettlementBatch,
  processSettlementBatch,
} = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ email: 'finance@example.com' });
  mockRpc.mockResolvedValue({ data: 'batch-1', error: null });
  mockCreateClient.mockReturnValue(makeSupabase());
  mockRefreshSelcomBalance.mockResolvedValue({
    querySucceeded: true,
    availableBalance: 50000000,
    accountActive: true,
    currency: 'TZS',
    maskedAccountNumber: '****2515',
    errorMessage: null,
  });
});

// Settlement batches (including balance reservation for them) are not
// handled by BizLink Africa — BizLink Africa does not receive, hold,
// reconcile, disburse or settle merchant funds, so there is no settlement
// batch to prepare, review, approve, hold or process. Every exported
// action in ./actions.ts calls assertMerchantSettlementsNotBizLinkManaged()
// as its very first statement (see BIZLINK_MANAGES_MERCHANT_SETTLEMENTS in
// src/lib/archived-financial-prototype.ts), so every one of them must fail
// unconditionally, before ever reaching a permission check, validation, the
// Selcom balance check/reservation, or the RPC/DB layer — regardless of
// what the caller's permissions are. See
// src/app/admin/(protected)/chargebacks/actions.test.ts for the sibling
// module this pattern was first applied to, and
// src/lib/archived-financial-prototype.ts for the guard itself.
describe('settlement batches are not handled by BizLink Africa — always blocked', () => {
  const cases: [string, () => Promise<{ success: boolean; message?: string }>][] = [
    ['prepareSettlementBatch', () => prepareSettlementBatch('2026-08-01', null)],
    ['submitSettlementBatchForReview', () => submitSettlementBatchForReview('batch-1', null)],
    ['reviewSettlementBatch', () => reviewSettlementBatch('batch-1', 'ok')],
    ['rejectSettlementBatch', () => rejectSettlementBatch('batch-1', 'a good reason')],
    ['approveSettlementBatch', () => approveSettlementBatch('batch-1', 'ok')],
    ['placeSettlementBatchHold', () => placeSettlementBatchHold('batch-1', 'a reason')],
    ['releaseSettlementBatchHold', () => releaseSettlementBatchHold('batch-1', '')],
    ['emergencyCancelSettlementBatch', () => emergencyCancelSettlementBatch('batch-1', 'a reason')],
    ['processSettlementBatch', () => processSettlementBatch('batch-1')],
  ];

  for (const [name, action] of cases) {
    it(`${name} is permanently blocked, even when the caller has permission`, async () => {
      const result = await action();
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'Merchant payouts are not handled by BizLink Africa. Settlement is managed directly by each merchant through the approved payment partner.'
      );
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockRefreshSelcomBalance).not.toHaveBeenCalled();
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  }

  it('approveSettlementBatch never reserves Selcom balance for the batch — reserve-payout-balance is blocked too', async () => {
    const result = await approveSettlementBatch('batch-1', 'ok');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalledWith('reserve_selcom_balance_for_batch', expect.anything());
  });

  it('never reaches the permission check either — a caller with no permission at all gets the same archived message', async () => {
    mockRequirePermission.mockRejectedValue(new Error('no'));
    const result = await prepareSettlementBatch('2026-08-01', null);
    expect(result.success).toBe(false);
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it('approveSettlementBatch never checks the Selcom balance — the archived guard fires before that step', async () => {
    const result = await approveSettlementBatch('batch-1', 'ok');
    expect(result.success).toBe(false);
    expect(mockRefreshSelcomBalance).not.toHaveBeenCalled();
  });

  it('processSettlementBatch never runs the sandbox payout adapter per line — nothing is ever processed', async () => {
    const result = await processSettlementBatch('batch-1');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalledWith('begin_settlement_batch_processing', expect.anything());
    expect(mockRpc).not.toHaveBeenCalledWith('apply_settlement_line_payout_result', expect.anything());
  });
});
