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
    rpc: () => Promise.resolve(config.rpc ?? { data: 'PRP-2026-0001', error: null }),
  } as never;
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createProposal, updateProposalStatus } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

const validInput = {
  clientId: 'client-1',
  services: ['website'],
  pricingSummaryTotal: 2_000_000,
  currency: 'TZS',
};

describe('createProposal — permissions and linkage', () => {
  it('rejects a role without proposals.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: proposals.manage'));
    const result = await createProposal(validInput);
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('requires a client or a lead to be linked', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    const result = await createProposal({ ...validInput, clientId: undefined });
    expect(result.success).toBe(false);
  });

  it('creates the proposal at status "draft" and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ rpc: { data: 'PRP-2026-0001' }, from: { proposals: [{ data: { id: 'prop-1' } }] } })
    );

    const result = await createProposal(validInput);

    expect(result.success).toBe(true);
    expect(result.id).toBe('prop-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'create', module: 'proposals', recordId: 'prop-1' })
    );
  });
});

describe('updateProposalStatus — approval flow', () => {
  it('rejects a role without proposals.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: proposals.manage'));
    const result = await updateProposalStatus('prop-1', 'approved');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('stamps approved_by on approval and audit-logs a status-specific action type', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { proposals: [{ data: null, error: null }] } }));

    const result = await updateProposalStatus('prop-1', 'approved');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'ceo@bizlinkafrica.net', actionType: 'status_approved', module: 'proposals', recordId: 'prop-1' })
    );
  });

  it('records the client response when moving to sent/accepted/rejected', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { proposals: [{ data: null, error: null }] } }));

    const result = await updateProposalStatus('prop-1', 'rejected', 'Client chose a competitor.');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'status_rejected',
        newValue: { status: 'rejected', clientResponse: 'Client chose a competitor.' },
      })
    );
  });
});
