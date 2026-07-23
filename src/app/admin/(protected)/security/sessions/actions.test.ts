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
  const updateCalls: { table: string; payload: unknown }[] = [];
  function builder(table: string) {
    const resolve = () => {
      const next = (queues[table] ?? []).shift() ?? { data: null, error: null };
      return Promise.resolve({ data: next.data, error: next.error ?? null });
    };
    const api = {
      select: () => api,
      insert: () => api,
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
  return { from: (table: string) => builder(table), __updateCalls: updateCalls } as never as {
    from: (t: string) => unknown;
    __updateCalls: typeof updateCalls;
  };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { revokeSession } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('revokeSession — "Security can revoke sessions when authorized"', () => {
  it('rejects a role without sessions.manage — the unauthorized case', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));

    const result = await revokeSession('sess-1');

    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('revokes the session, stamps who/when, and audit-logs it — the authorized case', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'security@bizlinkafrica.net' });
    const supabase = makeSupabase({ user_sessions: [{ data: null, error: null }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await revokeSession('sess-1');

    expect(result.success).toBe(true);
    expect(supabase.__updateCalls[0].payload).toMatchObject({ revoked: true, revoked_by: 'security@bizlinkafrica.net' });
    expect(supabase.__updateCalls[0].payload).toHaveProperty('revoked_at');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'revoke', module: 'user_sessions', recordId: 'sess-1' })
    );
  });

  it('surfaces the database error instead of silently succeeding', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'security@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ user_sessions: [{ data: null, error: { message: 'db error' } }] }));

    const result = await revokeSession('sess-1');

    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});
