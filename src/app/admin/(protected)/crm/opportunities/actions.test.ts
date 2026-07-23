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
      eq: () => api,
      single: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: 'OPP-2026-0001', error: null }),
  } as never;
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createOpportunity, updateOpportunityStage } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

const validInput = {
  name: 'Acme website revamp',
  clientId: 'client-1',
  estimatedValue: 5_000_000,
  currency: 'TZS',
  probability: 40,
};

describe('createOpportunity — permissions and linkage', () => {
  it('rejects a role without opportunities.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: opportunities.manage'));
    const result = await createOpportunity(validInput);
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('requires a client or a lead to be linked', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    const result = await createOpportunity({ ...validInput, clientId: undefined, leadId: undefined });
    expect(result.success).toBe(false);
  });

  it('creates the opportunity at stage "identified" and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ rpc: { data: 'OPP-2026-0001' }, from: { opportunities: [{ data: { id: 'opp-1' } }] } })
    );

    const result = await createOpportunity(validInput);

    expect(result.success).toBe(true);
    expect(result.id).toBe('opp-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'create', module: 'opportunities', recordId: 'opp-1' })
    );
  });
});

describe('updateOpportunityStage — pipeline stage transitions', () => {
  it('rejects a role without opportunities.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: opportunities.manage'));
    const result = await updateOpportunityStage('opp-1', 'qualified');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('writes the new stage and audit-logs a stage-specific action type', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { opportunities: [{ data: null, error: null }] } }));

    const result = await updateOpportunityStage('opp-1', 'won');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'stage_won', module: 'opportunities', recordId: 'opp-1', newValue: { stage: 'won' } })
    );
  });
});
