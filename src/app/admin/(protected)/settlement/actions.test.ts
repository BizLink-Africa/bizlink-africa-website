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

describe('permission gating — every mutating action requires server-side permission, never trusts the client', () => {
  it('prepareSettlementBatch requires settlement.prepare', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await prepareSettlementBatch('2026-08-01', null);
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('submitSettlementBatchForReview requires settlement.prepare', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await submitSettlementBatchForReview('batch-1', null);
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('reviewSettlementBatch requires settlement.review', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await reviewSettlementBatch('batch-1', 'ok');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejectSettlementBatch requires settlement.review', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await rejectSettlementBatch('batch-1', 'a good reason');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('approveSettlementBatch requires settlement.approve', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await approveSettlementBatch('batch-1', 'ok');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('placeSettlementBatchHold requires settlement.compliance_hold', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await placeSettlementBatchHold('batch-1', 'a reason');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('releaseSettlementBatchHold requires settlement.compliance_hold', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await releaseSettlementBatchHold('batch-1', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('emergencyCancelSettlementBatch requires settlement.emergency', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await emergencyCancelSettlementBatch('batch-1', 'a reason');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('processSettlementBatch requires settlement.process', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await processSettlementBatch('batch-1');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('reason-required validations — approval/hold/cancellation decisions cannot be silent', () => {
  it('rejectSettlementBatch rejects an empty reason before calling the RPC', async () => {
    const result = await rejectSettlementBatch('batch-1', '   ');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('placeSettlementBatchHold rejects an empty reason before calling the RPC', async () => {
    const result = await placeSettlementBatchHold('batch-1', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('emergencyCancelSettlementBatch rejects an empty reason before calling the RPC', async () => {
    const result = await emergencyCancelSettlementBatch('batch-1', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('server-side error surfacing — RPC/database rejections (e.g. maker-checker violations) are never swallowed', () => {
  it('surfaces a maker-checker violation message from approve_settlement_batch', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Maker-checker violation: the approver must be different from the preparer' } });
    const result = await approveSettlementBatch('batch-1', 'ok');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Maker-checker violation');
  });

  it('audit-logs a successful approval', async () => {
    const result = await approveSettlementBatch('batch-1', 'looks good');
    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'approve', module: 'settlement_batches', recordId: 'batch-1' })
    );
  });
});

describe('approveSettlementBatch — Selcom balance verification before approval', () => {
  it('checks a fresh Selcom balance (trigger_type batch_approval) before calling approve_settlement_batch', async () => {
    await approveSettlementBatch('batch-1', 'ok');
    expect(mockRefreshSelcomBalance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ triggerType: 'batch_approval', batchId: 'batch-1' })
    );
    expect(mockRpc).toHaveBeenCalledWith('approve_settlement_batch', expect.objectContaining({ p_available_balance: 50000000 }));
  });

  it('refuses to approve when the balance check itself fails, without ever calling approve_settlement_batch', async () => {
    mockRefreshSelcomBalance.mockResolvedValue({
      querySucceeded: false,
      availableBalance: null,
      accountActive: null,
      currency: null,
      maskedAccountNumber: null,
      errorMessage: 'Selcom balance check failed.',
    });
    const result = await approveSettlementBatch('batch-1', 'ok');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalledWith('approve_settlement_batch', expect.anything());
  });

  it('surfaces an insufficient-balance rejection from the database as the action result message', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Insufficient cleared Selcom disbursement balance: available 100, already reserved for other batches 0, this batch requires 5000.' } });
    const result = await approveSettlementBatch('batch-1', 'ok');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient cleared Selcom disbursement balance');
  });
});

describe('processSettlementBatch — runs the sandbox adapter per line, never a real payout call', () => {
  it('begins processing, then applies a payout result RPC call for every pending line', async () => {
    const result = await processSettlementBatch('batch-1');
    expect(result.success).toBe(true);

    const rpcCalls = mockRpc.mock.calls.map((c) => c[0]);
    expect(rpcCalls).toContain('begin_settlement_batch_processing');
    expect(rpcCalls.filter((name) => name === 'apply_settlement_line_payout_result')).toHaveLength(2);
  });

  it('reports a failed result (no beneficiary) for a line with no beneficiary on file', async () => {
    await processSettlementBatch('batch-1');
    const failedCall = mockRpc.mock.calls.find(
      (c) => c[0] === 'apply_settlement_line_payout_result' && c[1].p_line_id === 'line-2'
    );
    expect(failedCall?.[1].p_status).toBe('failed');
  });

  it('stops before calling any line-level RPC if begin_settlement_batch_processing fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'This batch is on compliance hold and cannot be processed' } });
    const result = await processSettlementBatch('batch-1');
    expect(result.success).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
