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
    select: () => api,
    update: (payload: unknown) => {
      updateCalls.push(payload);
      return api;
    },
    eq: () => api,
    maybeSingle: () => Promise.resolve(result),
    then: (onFulfilled: (v: typeof result) => void) => Promise.resolve(result).then(onFulfilled),
  };
  return { from: () => api, __updateCalls: updateCalls } as never as { from: () => unknown; __updateCalls: unknown[] };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { setStaffMfa } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setStaffMfa — MFA flag toggled from the Staff & Roles actions menu', () => {
  it('rejects without users.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await setStaffMfa('staff-1', true);
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('updates mfa_enabled and audit-logs the change', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const supabase = makeSupabase({ data: null, error: null });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await setStaffMfa('staff-1', true);

    expect(result.success).toBe(true);
    expect(supabase.__updateCalls[0]).toEqual({ mfa_enabled: true });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'staff_profiles', recordId: 'staff-1', actionType: 'update_mfa_status' })
    );
  });

  it('surfaces a database error as a friendly message', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const supabase = makeSupabase({ data: null, error: { message: 'db down' } });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await setStaffMfa('staff-1', false);

    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});
