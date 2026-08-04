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

// The entire Chargebacks & Holds module (cases, evidence, resolution,
// recovery, settlement holds, and manual reversals) is an archived
// financial prototype. Opening a new chargeback case fundamentally depends
// on collection_transactions — BizLink's own record of merchant
// collections — which is itself archived, since BizLink Africa does not
// receive, hold, reconcile, disburse or settle merchant funds. Manual
// reversals write directly against that same archived collection ledger.
// Every exported action in ./actions.ts calls
// assertArchivedFinancialPrototypeReadOnly() as its very first statement
// (see src/lib/archived-financial-prototype.ts), so every one of them must
// fail unconditionally, before ever reaching a permission check,
// re-authentication, validation, or the RPC/upsert/DB layer — regardless
// of what the caller's permissions are. See
// src/app/admin/(protected)/settlement/actions.test.ts for the sibling
// module this pattern was first applied to.
describe('chargebacks & holds are an archived financial prototype — always blocked', () => {
  const ARCHIVED_MESSAGE =
    'This module is archived and permanently read-only. BizLink Africa does not handle merchant funds or settlements.';

  const cases: [string, () => Promise<{ success: boolean; message?: string }>][] = [
    ['openChargebackCase', () => openChargebackCase('txn-1', '1000.00', '0', 'fraud', null)],
    ['requestChargebackEvidence', () => requestChargebackEvidence('case-1', null)],
    ['submitChargebackEvidence', () => submitChargebackEvidence('case-1')],
    ['upsertEvidenceItem', () => upsertEvidenceItem('case-1', 'proof_of_delivery', 'submitted', '')],
    ['beginChargebackReview', () => beginChargebackReview('case-1')],
    ['resolveChargebackCase', () => resolveChargebackCase('case-1', 'lost', 'ruling received')],
    ['closeChargebackCase', () => closeChargebackCase('case-1', '')],
    ['recordChargebackRecovery', () => recordChargebackRecovery('case-1', '500.00', 'manual_invoice', '')],
    ['placeSettlementHold', () => placeSettlementHold('merchant-1', null, null, 'suspected fraud', '0', null)],
    ['requestSettlementHoldRelease', () => requestSettlementHoldRelease('hold-1', 'cleared')],
    ['approveSettlementHoldRelease', () => approveSettlementHoldRelease('hold-1', '')],
    ['rejectSettlementHoldRelease', () => rejectSettlementHoldRelease('hold-1', '')],
    ['requestManualReversal', () => requestManualReversal('txn-1', '1000.00', 'lost dispute', null)],
    ['approveManualReversal', () => approveManualReversal('req-1', '')],
    ['rejectManualReversal', () => rejectManualReversal('req-1', 'insufficient justification')],
  ];

  for (const [name, action] of cases) {
    it(`${name} is permanently blocked, even when the caller has permission`, async () => {
      const result = await action();
      expect(result.success).toBe(false);
      expect(result.message).toBe(ARCHIVED_MESSAGE);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  }

  it('never reaches the permission check either — a caller with no permission at all gets the same archived message', async () => {
    mockRequirePermission.mockRejectedValue(new Error('no'));
    const result = await openChargebackCase('txn-1', '1000.00', '0', 'fraud', null);
    expect(result.success).toBe(false);
    expect(result.message).toBe(ARCHIVED_MESSAGE);
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it('recordChargebackRecovery never reaches the settlement_deduction validation — the archived guard fires first', async () => {
    const result = await recordChargebackRecovery('case-1', '500.00', 'settlement_deduction', '');
    expect(result.success).toBe(false);
    expect(result.message).toBe(ARCHIVED_MESSAGE);
  });

  it('openChargebackCase never reaches money-format validation — the archived guard fires first', async () => {
    const result = await openChargebackCase('txn-1', 'not-a-number', '0', 'fraud', null);
    expect(result.success).toBe(false);
    expect(result.message).toBe(ARCHIVED_MESSAGE);
  });
});
