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

function makeSupabase(result: { data: unknown; error: unknown }) {
  const updateCalls: unknown[] = [];
  const api = {
    update: (payload: unknown) => {
      updateCalls.push(payload);
      return api;
    },
    eq: () => api,
    then: (onFulfilled: (v: typeof result) => void) => Promise.resolve(result).then(onFulfilled),
  };
  return { from: () => api, __updateCalls: updateCalls } as never as { from: () => unknown; __updateCalls: unknown[] };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { updateDepartment, updateDepartmentStatus } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateDepartment — the 8-department catalog is edit-only, never create/delete', () => {
  it('rejects without departments.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateDepartment('dept-1', { manager: 'Jane Doe' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('updates only the fields provided and audit-logs the change', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const supabase = makeSupabase({ data: null, error: null });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await updateDepartment('dept-1', { manager: 'Jane Doe' });

    expect(result.success).toBe(true);
    expect(supabase.__updateCalls[0]).toEqual({ manager: 'Jane Doe' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'departments', recordId: 'dept-1' }));
  });

  it('clears manager to null when given an empty string', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const supabase = makeSupabase({ data: null, error: null });
    mockCreateClient.mockResolvedValueOnce(supabase);

    await updateDepartment('dept-1', { manager: '' });

    expect(supabase.__updateCalls[0]).toEqual({ manager: null });
  });
});

describe('updateDepartmentStatus — thin wrapper over updateDepartment', () => {
  it('rejects without departments.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateDepartmentStatus('dept-1', 'inactive');
    expect(result.success).toBe(false);
  });

  it('updates status', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const supabase = makeSupabase({ data: null, error: null });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await updateDepartmentStatus('dept-1', 'inactive');

    expect(result.success).toBe(true);
    expect(supabase.__updateCalls[0]).toEqual({ status: 'inactive' });
  });
});
