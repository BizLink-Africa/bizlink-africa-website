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

interface QueueEntry {
  data: unknown;
  error?: unknown;
}

function makeSupabase(from: Record<string, QueueEntry[]>) {
  const queues: Record<string, QueueEntry[]> = Object.fromEntries(Object.entries(from).map(([k, v]) => [k, [...v]]));
  const insertCalls: { table: string; payload: unknown }[] = [];
  const updateCalls: { table: string; payload: unknown }[] = [];
  function builder(table: string) {
    const resolve = () => {
      const next = (queues[table] ?? []).shift() ?? { data: null, error: null };
      return Promise.resolve({ data: next.data, error: next.error ?? null });
    };
    const api = {
      select: () => api,
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return api;
      },
      update: (payload: unknown) => {
        updateCalls.push({ table, payload });
        return api;
      },
      eq: () => api,
      single: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return {
    from: (table: string) => builder(table),
    __insertCalls: insertCalls,
    __updateCalls: updateCalls,
  } as never as { from: (t: string) => unknown; __insertCalls: typeof insertCalls; __updateCalls: typeof updateCalls };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createApprovalRequest, decideApprovalRequest, setWorkflowActive } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createApprovalRequest — a queued intent, never a mutation of the underlying record', () => {
  it('rejects without approval_workflows.view', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createApprovalRequest({ category: 'expenses', subjectLabel: 'Expense #1' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'staff@bizlinkafrica.net' });
    // @ts-expect-error deliberately invalid category for the test
    const result = await createApprovalRequest({ category: 'not_a_category', subjectLabel: 'X' });
    expect(result.success).toBe(false);
  });

  it('records status pending and audit-logs the creation', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'staff@bizlinkafrica.net' });
    const supabase = makeSupabase({ approval_requests: [{ data: { id: 'req-1' } }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createApprovalRequest({ category: 'expenses', subjectLabel: 'Expense #1', amount: 500 });

    expect(result.success).toBe(true);
    expect(supabase.__insertCalls[0].payload).toMatchObject({ status: 'pending', category: 'expenses', subject_label: 'Expense #1' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'approval_requests', actionType: 'create' }));
  });
});

describe('decideApprovalRequest — every decision is audited, and "pending" is not a valid decision', () => {
  it('rejects without approval_workflows.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await decideApprovalRequest('req-1', 'approved');
    expect(result.success).toBe(false);
  });

  it('rejects setting status back to pending', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const result = await decideApprovalRequest('req-1', 'pending');
    expect(result.success).toBe(false);
  });

  it('records the decision with decided_by/decided_at and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const supabase = makeSupabase({ approval_requests: [{ data: null, error: null }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await decideApprovalRequest('req-1', 'approved', 'Looks good');

    expect(result.success).toBe(true);
    expect(supabase.__updateCalls[0].payload).toMatchObject({ status: 'approved', decision_notes: 'Looks good', decided_by: 'ceo@bizlinkafrica.net' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'decision_approved', module: 'approval_requests', recordId: 'req-1' }));
  });
});

describe('setWorkflowActive', () => {
  it('rejects without approval_workflows.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await setWorkflowActive('wf-1', false);
    expect(result.success).toBe(false);
  });

  it('updates is_active and audit-logs activate/deactivate', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const supabase = makeSupabase({ approval_workflows: [{ data: null, error: null }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await setWorkflowActive('wf-1', false);

    expect(result.success).toBe(true);
    expect(supabase.__updateCalls[0].payload).toEqual({ is_active: false });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'deactivate', module: 'approval_workflows' }));
  });
});
