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

const { runDailyReconciliation, approveReconciliationRun } = await import('./actions');

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

describe('runDailyReconciliation — never computes totals itself, only relays the RPC result', () => {
  it('requires collections.reconcile permission', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await runDailyReconciliation({ fromDate: '2026-08-01', toDate: '2026-08-01' });
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('requires both a from and to date', async () => {
    const result = await runDailyReconciliation({ fromDate: '', toDate: '2026-08-01' });
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects a malformed vendor amount before calling the RPC', async () => {
    const result = await runDailyReconciliation({ fromDate: '2026-08-01', toDate: '2026-08-01', vendorAmountReceived: 'abc' });
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls run_collection_reconciliation with the raw decimal string, never a parsed number', async () => {
    await runDailyReconciliation({ fromDate: '2026-08-01', toDate: '2026-08-02', vendorAmountReceived: '12345.67' });
    expect(mockRpc).toHaveBeenCalledWith(
      'run_collection_reconciliation',
      expect.objectContaining({ p_vendor_amount_received: '12345.67' })
    );
  });
});

describe('approveReconciliationRun — the only path to settlement eligibility', () => {
  it('requires collections.approve permission', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await approveReconciliationRun('run-1', 'looks good');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('surfaces the RPC error message when a run is already approved (immutability)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'This reconciliation run has already been approved' } });
    const result = await approveReconciliationRun('run-1', '');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already been approved');
  });

  it('audit-logs the approval on success', async () => {
    const result = await approveReconciliationRun('run-1', 'confirmed against bank statement');
    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'approve_reconciliation_run', recordId: 'run-1' })
    );
  });
});
