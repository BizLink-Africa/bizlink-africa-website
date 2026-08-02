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

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { importSandboxStatement, importCollectionStatementCsv, requestManualAdjustment } = await import('./actions');

function makeCsvFormData(csvText: string, filename = 'statement.csv'): FormData {
  const formData = new FormData();
  formData.append('file', new File([csvText], filename, { type: 'text/csv' }));
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  mockRequirePermission.mockResolvedValue({ email: 'ops@example.com' });
  mockCreateClient.mockReturnValue(makeSupabase());
});

describe('importSandboxStatement — sandbox mode, no live API involved', () => {
  it('inserts sandbox rows as unmatched (not duplicate) when no existing reference is found', async () => {
    const result = await importSandboxStatement('2026-08-01', '2026-08-01');

    expect(result.success).toBe(true);
    const txnInserts = insertCalls.filter((c) => c.table === 'collection_transactions');
    expect(txnInserts).toHaveLength(2);
    for (const call of txnInserts) {
      expect(call.payload.reconciliation_status).toBe('unmatched');
      expect(call.payload.duplicate_of_transaction_id).toBeNull();
      // Money values are passed through as the original decimal string —
      // never a JS number.
      expect(typeof call.payload.gross_amount).toBe('string');
    }
  });

  it('requires collections.manage permission', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await importSandboxStatement('2026-08-01', '2026-08-01');
    expect(result.success).toBe(false);
    expect(insertCalls.filter((c) => c.table === 'collection_transactions')).toHaveLength(0);
  });
});

describe('importCollectionStatementCsv — duplicate reference detection against existing ledger rows', () => {
  it('flags a reference that already exists in the ledger as duplicate — never settlement-eligible, never dropped', async () => {
    const csv = [
      'provider_transaction_reference,gross_amount,collected_at',
      'TXN-EXISTING-001,500.00,2026-08-01T09:00:00Z',
    ].join('\n');

    const result = await importCollectionStatementCsv(makeCsvFormData(csv));

    expect(result.success).toBe(true);
    expect(result.duplicates).toBe(1);
    expect(result.imported).toBe(0);

    const call = insertCalls.find((c) => c.table === 'collection_transactions');
    expect(call?.payload).toMatchObject({
      reconciliation_status: 'duplicate',
      duplicate_of_transaction_id: 'existing-row-id',
    });
  });

  it('imports a genuinely new reference as unmatched, not duplicate', async () => {
    const csv = [
      'provider_transaction_reference,gross_amount,collected_at',
      'TXN-NEW-001,500.00,2026-08-01T09:00:00Z',
    ].join('\n');

    const result = await importCollectionStatementCsv(makeCsvFormData(csv));

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(0);

    const call = insertCalls.find((c) => c.table === 'collection_transactions');
    expect(call?.payload).toMatchObject({ reconciliation_status: 'unmatched', duplicate_of_transaction_id: null });
  });

  it('rejects a non-CSV file', async () => {
    const formData = new FormData();
    formData.append('file', new File(['not a csv'], 'statement.txt', { type: 'text/plain' }));
    const result = await importCollectionStatementCsv(formData);
    expect(result.success).toBe(false);
  });
});

describe('requestManualAdjustment — validation never trusts unvalidated money input', () => {
  it('rejects a malformed adjustment amount without inserting anything', async () => {
    const result = await requestManualAdjustment('txn-1', 'not-a-number', 'Fee correction');
    expect(result.success).toBe(false);
    expect(insertCalls.filter((c) => c.table === 'collection_manual_adjustments')).toHaveLength(0);
  });

  it('rejects a missing reason', async () => {
    const result = await requestManualAdjustment('txn-1', '10.00', '');
    expect(result.success).toBe(false);
  });

  it('accepts a valid negative adjustment with a reason and records it as pending approval', async () => {
    const result = await requestManualAdjustment('txn-1', '-5.00', 'Duplicate fee charged by provider');
    expect(result.success).toBe(true);
    const call = insertCalls.find((c) => c.table === 'collection_manual_adjustments');
    expect(call?.payload).toMatchObject({ transaction_id: 'txn-1', adjustment_amount: '-5.00' });
  });

  it('requires collections.manage permission', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await requestManualAdjustment('txn-1', '10.00', 'reason');
    expect(result.success).toBe(false);
  });
});
