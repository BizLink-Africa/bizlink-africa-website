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

// Existing references: TXN references containing "EXISTING" simulate a
// reference already present in the ledger (duplicate); everything else is
// treated as new.
const insertCalls: { table: string; payload: Record<string, unknown> }[] = [];

function makeSupabase() {
  const api: Record<string, unknown> = {
    from: (table: string) => builder(table),
  };
  return api;

  function builder(table: string) {
    let lastEqValue: unknown;
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (_col: string, value: unknown) => {
        lastEqValue = value;
        return b;
      },
      limit: () => b,
      maybeSingle: () => {
        if (table === 'collection_transactions') {
          const isDuplicate = typeof lastEqValue === 'string' && lastEqValue.includes('EXISTING');
          return Promise.resolve({ data: isDuplicate ? { id: 'existing-row-id' } : null, error: null });
        }
        if (table === 'merchant_tills') {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single: () => Promise.resolve({ data: { id: `${table}-generated-id` }, error: null }),
      insert: (payload: Record<string, unknown>) => {
        insertCalls.push({ table, payload });
        return b;
      },
    };
    return b;
  }
}

const mockRpc = vi.fn();
const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { importSandboxStatement, importCollectionStatementCsv, requestManualAdjustment, reviewManualAdjustment } = await import('./actions');

function makeCsvFormData(csvText: string, filename = 'statement.csv'): FormData {
  const formData = new FormData();
  formData.append('file', new File([csvText], filename, { type: 'text/csv' }));
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  mockRequirePermission.mockResolvedValue({ email: 'ops@example.com' });
  mockRpc.mockResolvedValue({ data: null, error: null });
  mockCreateClient.mockReturnValue({ ...makeSupabase(), rpc: mockRpc });
});

// Collection statement import, manual adjustment requests, and manual
// adjustment review are all part of the archived financial prototype —
// BizLink Africa does not receive, hold, reconcile, disburse or settle
// merchant funds, so there is no collection ledger to import into or
// adjust. Every exported action in ./actions.ts calls
// assertArchivedFinancialPrototypeReadOnly() as its very first statement,
// so every one of them must fail unconditionally, before ever reaching a
// permission check, file/amount validation, or the insert/RPC layer —
// regardless of what the caller's permissions are. See
// src/app/admin/(protected)/chargebacks/actions.test.ts for the sibling
// module this pattern was first applied to, and
// src/lib/archived-financial-prototype.ts for the guard itself.
describe('collection statement import and manual adjustments are an archived financial prototype — always blocked', () => {
  it('importSandboxStatement is permanently read-only, even when the caller has permission', async () => {
    const result = await importSandboxStatement('2026-08-01', '2026-08-01');
    expect(result.success).toBe(false);
    expect(insertCalls.filter((c) => c.table === 'collection_transactions')).toHaveLength(0);
  });

  it('importCollectionStatementCsv is permanently read-only, even for a well-formed CSV', async () => {
    const csv = [
      'provider_transaction_reference,gross_amount,collected_at',
      'TXN-NEW-001,500.00,2026-08-01T09:00:00Z',
    ].join('\n');
    const result = await importCollectionStatementCsv(makeCsvFormData(csv));
    expect(result.success).toBe(false);
    expect(insertCalls.filter((c) => c.table === 'collection_transactions')).toHaveLength(0);
  });

  it('requestManualAdjustment is permanently read-only, even for a well-formed request', async () => {
    const result = await requestManualAdjustment('txn-1', '-5.00', 'Duplicate fee charged by provider');
    expect(result.success).toBe(false);
    expect(insertCalls.filter((c) => c.table === 'collection_manual_adjustments')).toHaveLength(0);
  });

  it('reviewManualAdjustment is permanently read-only, for both approve and reject decisions', async () => {
    const approveResult = await reviewManualAdjustment('adj-1', 'txn-1', 'approve', '');
    const rejectResult = await reviewManualAdjustment('adj-1', 'txn-1', 'reject', 'not justified');
    expect(approveResult.success).toBe(false);
    expect(rejectResult.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('never reaches the permission check either — a caller with no permission at all gets the same archived message', async () => {
    mockRequirePermission.mockRejectedValue(new Error('no'));
    const result = await importSandboxStatement('2026-08-01', '2026-08-01');
    expect(result.success).toBe(false);
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it('never logs an audit event, since no mutation ever occurs', async () => {
    await importSandboxStatement('2026-08-01', '2026-08-01');
    await requestManualAdjustment('txn-1', '10.00', 'reason');
    await reviewManualAdjustment('adj-1', 'txn-1', 'approve', '');
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});
