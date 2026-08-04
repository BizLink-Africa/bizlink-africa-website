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

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { runDailyReconciliation, approveReconciliationRun, flagTransactionUnderReview } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ email: 'cfo@example.com' });
  mockRpc.mockResolvedValue({ data: 'run-id-1', error: null });
  mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  mockCreateClient.mockReturnValue({
    rpc: mockRpc,
    from: () => ({ update: mockUpdate }),
  });
});

// Collection reconciliation runs are an archived financial prototype —
// BizLink Africa does not receive, hold, reconcile, disburse or settle
// merchant funds, so there is nothing to reconcile against a vendor
// account. Every exported action in ./actions.ts calls
// assertArchivedFinancialPrototypeReadOnly() as its very first statement,
// so every one of them must fail unconditionally, before ever reaching a
// permission check, date/amount validation, or the RPC/DB layer —
// regardless of what the caller's permissions are. See
// src/app/admin/(protected)/chargebacks/actions.test.ts for the sibling
// module this pattern was first applied to, and
// src/lib/archived-financial-prototype.ts for the guard itself.
describe('reconciliation runs are an archived financial prototype — always blocked', () => {
  const cases: [string, () => Promise<{ success: boolean }>][] = [
    ['runDailyReconciliation', () => runDailyReconciliation({ fromDate: '2026-08-01', toDate: '2026-08-02', vendorAmountReceived: '12345.67' })],
    ['approveReconciliationRun', () => approveReconciliationRun('run-1', 'confirmed against bank statement')],
    ['flagTransactionUnderReview', () => flagTransactionUnderReview('txn-1', 'looks off')],
  ];

  for (const [name, action] of cases) {
    it(`${name} is permanently read-only, even when the caller has permission and the input is well-formed`, async () => {
      const result = await action();
      expect(result.success).toBe(false);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  }

  it('never reaches the permission check either — a caller with no permission at all gets the same archived message', async () => {
    mockRequirePermission.mockRejectedValue(new Error('no'));
    const result = await runDailyReconciliation({ fromDate: '2026-08-01', toDate: '2026-08-01' });
    expect(result.success).toBe(false);
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it('runDailyReconciliation never even reaches its date-range validation — blocked before that check runs', async () => {
    const result = await runDailyReconciliation({ fromDate: '', toDate: '' });
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
