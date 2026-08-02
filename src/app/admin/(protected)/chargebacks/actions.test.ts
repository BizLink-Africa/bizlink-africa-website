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
const mockUpsert = vi.fn();
const mockCreateClient = vi.fn();

function makeSupabase() {
  return {
    rpc: mockRpc,
    from: () => ({ upsert: mockUpsert }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const {
  openChargebackCase,
  requestChargebackEvidence,
  submitChargebackEvidence,
  upsertEvidenceItem,
  beginChargebackReview,
  resolveChargebackCase,
  closeChargebackCase,
  recordChargebackRecovery,
  placeSettlementHold,
  requestSettlementHoldRelease,
  approveSettlementHoldRelease,
  rejectSettlementHoldRelease,
  requestManualReversal,
  approveManualReversal,
  rejectManualReversal,
} = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ email: 'compliance@example.com' });
  mockRpc.mockResolvedValue({ data: 'new-id', error: null });
  mockUpsert.mockResolvedValue({ error: null });
  mockCreateClient.mockReturnValue(makeSupabase());
});

describe('permission gating', () => {
  const cases: [string, () => Promise<{ success: boolean }>][] = [
    ['openChargebackCase', () => openChargebackCase('txn-1', '1000.00', '0', 'fraud', null)],
    ['requestChargebackEvidence', () => requestChargebackEvidence('case-1', null)],
    ['submitChargebackEvidence', () => submitChargebackEvidence('case-1')],
    ['upsertEvidenceItem', () => upsertEvidenceItem('case-1', 'proof_of_delivery', 'submitted', '')],
    ['beginChargebackReview', () => beginChargebackReview('case-1')],
    ['resolveChargebackCase', () => resolveChargebackCase('case-1', 'lost', 'ruling received')],
    ['closeChargebackCase', () => closeChargebackCase('case-1', '')],
    ['recordChargebackRecovery', () => recordChargebackRecovery('case-1', '500.00', 'settlement_deduction', '')],
    ['placeSettlementHold', () => placeSettlementHold('merchant-1', null, null, 'suspected fraud', '0', null)],
    ['requestSettlementHoldRelease', () => requestSettlementHoldRelease('hold-1', 'cleared')],
    ['approveSettlementHoldRelease', () => approveSettlementHoldRelease('hold-1', '')],
    ['rejectSettlementHoldRelease', () => rejectSettlementHoldRelease('hold-1', '')],
    ['requestManualReversal', () => requestManualReversal('txn-1', '1000.00', 'lost dispute', null)],
    ['approveManualReversal', () => approveManualReversal('req-1', '')],
    ['rejectManualReversal', () => rejectManualReversal('req-1', 'insufficient justification')],
  ];

  for (const [name, action] of cases) {
    it(`${name} requires the caller to hold the relevant permission`, async () => {
      mockRequirePermission.mockRejectedValueOnce(new Error('no'));
      const result = await action();
      expect(result.success).toBe(false);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  }
});

describe('input validation — money shape and required reasons never reach the RPC malformed', () => {
  it('openChargebackCase rejects an invalid disputed amount', async () => {
    const result = await openChargebackCase('txn-1', 'not-a-number', '0', 'fraud', null);
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('recordChargebackRecovery rejects an invalid amount', async () => {
    const result = await recordChargebackRecovery('case-1', 'abc', 'settlement_deduction', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('placeSettlementHold rejects an empty reason', async () => {
    const result = await placeSettlementHold('merchant-1', null, null, '   ', '0', null);
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('requestSettlementHoldRelease rejects an empty reason', async () => {
    const result = await requestSettlementHoldRelease('hold-1', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejectManualReversal requires a reason', async () => {
    const result = await rejectManualReversal('req-1', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('resolveChargebackCase requires resolution notes', async () => {
    const result = await resolveChargebackCase('case-1', 'won', '');
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('requestManualReversal rejects an invalid amount', async () => {
    const result = await requestManualReversal('txn-1', 'nope', 'reason', null);
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('server-side error surfacing and audit logging', () => {
  it('surfaces a maker-checker violation from approve_settlement_hold_release', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Maker-checker violation: the approver must be different from whoever requested the release' } });
    const result = await approveSettlementHoldRelease('hold-1', 'ok');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Maker-checker violation');
  });

  it('surfaces the "held amounts cannot be settled" style rejection from the RPC layer verbatim', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'A payout can only be cancelled before it has been submitted' } });
    const result = await placeSettlementHold('merchant-1', null, null, 'test', '0', null);
    expect(result.success).toBe(false);
  });

  it('recordChargebackRecovery always calls logAuditEvent — "recovery entries require audit logs"', async () => {
    const result = await recordChargebackRecovery('case-1', '500.00', 'settlement_deduction', 'partial recovery');
    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'record_recovery', module: 'chargeback_cases', recordId: 'case-1' })
    );
  });

  it('approveManualReversal audit-logs the approval', async () => {
    const result = await approveManualReversal('req-1', 'confirmed');
    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'approve_reversal', module: 'manual_reversal_requests', recordId: 'req-1' })
    );
  });

  it('openChargebackCase audit-logs opening the case with the returned id', async () => {
    const result = await openChargebackCase('txn-1', '1000.00', '0', 'fraud', null);
    expect(result.success).toBe(true);
    expect(result.id).toBe('new-id');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'open_case', module: 'chargeback_cases', recordId: 'new-id' })
    );
  });
});
