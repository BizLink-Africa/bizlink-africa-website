// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequirePermission = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  verifyAdminSession: async () => ({ email: 'ceo@bizlinkafrica.net', id: 'user-1' }),
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Queue-based mock, same pattern as ../actions.test.ts — each table gets a
// queue of canned responses, shifted in call order.
function makeSupabase(config: { rpc?: { data: unknown; error?: unknown }; from: Record<string, Array<{ data: unknown; error?: unknown }>> }) {
  const queues: Record<string, Array<{ data: unknown; error?: unknown }>> = Object.fromEntries(
    Object.entries(config.from).map(([k, v]) => [k, [...v]])
  );
  function builder(table: string) {
    const resolve = () => {
      const next = (queues[table] ?? []).shift() ?? { data: null, error: null };
      return Promise.resolve({ data: next.data, error: next.error ?? null });
    };
    const api = {
      select: () => api,
      insert: () => api,
      update: () => api,
      upsert: () => api,
      eq: () => api,
      or: () => api,
      in: () => api,
      order: () => api,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: 'CLI-2026-0001', error: null }),
  } as never;
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createClientRecord, assignClientOwner, updateClientRecord } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

const validInput = {
  clientName: 'Jane Doe',
  businessName: 'Acme Ltd',
  email: 'jane@acme.com',
  phone: '0700000000',
};

describe('createClientRecord — duplicate prevention, permissions, audit', () => {
  it('rejects a role without clients.create', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: clients.create'));
    const result = await createClientRecord(validInput);
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('requires the core fields', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    const result = await createClientRecord({ ...validInput, clientName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a duplicate client matched by email, phone, or business name', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ from: { clients: [{ data: { id: 'client-existing', business_name: 'Acme Ltd' } }] } })
    );

    const result = await createClientRecord(validInput);

    expect(result.success).toBe(false);
    expect(result.duplicateOfId).toBe('client-existing');
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('generates a client number, inserts the client, and audit-logs the creation when no duplicate exists', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        rpc: { data: 'CLI-2026-0002' },
        from: { clients: [{ data: null }, { data: { id: 'client-1' } }] },
      })
    );

    const result = await createClientRecord(validInput);

    expect(result.success).toBe(true);
    expect(result.clientId).toBe('client-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'ops@bizlinkafrica.net', actionType: 'create', module: 'clients', recordId: 'client-1' })
    );
  });
});

describe('assignClientOwner — permissions and audit', () => {
  it('rejects a role without clients.update', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: clients.update'));
    const result = await assignClientOwner('client-1', 'staff-1');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('writes account_owner_id and audit-logs the assignment', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { clients: [{ data: null, error: null }] } }));

    const result = await assignClientOwner('client-1', 'staff-1');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'assign_owner', module: 'clients', recordId: 'client-1', newValue: { accountOwnerId: 'staff-1' } })
    );
  });
});

describe('updateClientRecord — permission enforcement and audit logging', () => {
  it('rejects a role without clients.update', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: clients.update'));
    const result = await updateClientRecord('client-1', { industry: 'Retail' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('updates the client and audit-logs the change for an authorized caller', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { clients: [{ data: null, error: null }] } }));

    const result = await updateClientRecord('client-1', { industry: 'Retail' });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'ops@bizlinkafrica.net', actionType: 'update', module: 'clients', recordId: 'client-1' })
    );
  });
});
