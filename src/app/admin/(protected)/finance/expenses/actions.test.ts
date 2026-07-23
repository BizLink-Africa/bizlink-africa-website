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

function makeSupabase(config: { from: Record<string, Array<{ data: unknown; error?: unknown }>> }) {
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
  return { from: (table: string) => builder(table) } as never;
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { approveExpense, ceoApproveExpense, rejectExpense } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('approveExpense — CFO stage decides the threshold branch server-side', () => {
  it('rejects a role without expenses.approve', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: expenses.approve'));
    const result = await approveExpense('exp-1');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('goes straight to approved when the amount is at or below the threshold', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        from: {
          expenses: [{ data: { amount: 400000, status: 'submitted' } }, { data: null, error: null }],
          company_settings: [{ data: { expense_high_value_threshold: 500000 } }],
        },
      })
    );

    const result = await approveExpense('exp-1');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'status_approved', newValue: expect.objectContaining({ status: 'approved' }) })
    );
  });

  it('routes to pending_ceo_approval — not approved — when the amount exceeds the threshold', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        from: {
          expenses: [{ data: { amount: 600000, status: 'submitted' } }, { data: null, error: null }],
          company_settings: [{ data: { expense_high_value_threshold: 500000 } }],
        },
      })
    );

    const result = await approveExpense('exp-2');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'cfo_approve_pending_ceo', newValue: expect.objectContaining({ status: 'pending_ceo_approval' }) })
    );
  });

  it('refuses to approve an expense that is not in the CFO queue', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cfo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        from: {
          expenses: [{ data: { amount: 100000, status: 'approved' } }],
          company_settings: [{ data: { expense_high_value_threshold: 500000 } }],
        },
      })
    );

    const result = await approveExpense('exp-3');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});

describe('ceoApproveExpense — final stage, only from pending_ceo_approval', () => {
  it('rejects a role without expenses.ceo_approve', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: expenses.ceo_approve'));
    const result = await ceoApproveExpense('exp-1');
    expect(result.success).toBe(false);
  });

  it('refuses to act on an expense still waiting on the CFO', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { expenses: [{ data: { status: 'submitted' } }] } }));

    const result = await ceoApproveExpense('exp-1');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('approves and stamps approved_by when the expense is pending_ceo_approval', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ from: { expenses: [{ data: { status: 'pending_ceo_approval' } }, { data: null, error: null }] } })
    );

    const result = await ceoApproveExpense('exp-1');
    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'ceo_approve' }));
  });
});

describe('rejectExpense — either approval stage can reject', () => {
  it('rejects a caller with neither expenses.approve nor expenses.ceo_approve', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await rejectExpense('exp-1');
    expect(result.success).toBe(false);
  });

  it('accepts a CEO-only approver (falls back past expenses.approve)', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: expenses.approve'));
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { expenses: [{ data: null, error: null }] } }));

    const result = await rejectExpense('exp-1');
    expect(result.success).toBe(true);
  });
});
