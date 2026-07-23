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
    rpc: () => Promise.resolve(config.rpc ?? { data: 'TSK-2026-0001', error: null }),
  } as never;
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createOperationalTask, updateOperationalTaskStatus } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOperationalTask — permissions and validation', () => {
  it('rejects a role without operations.tasks.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: operations.tasks.manage'));
    const result = await createOperationalTask({ title: 'Follow up on invoice', priority: 'normal' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects a blank title', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    const result = await createOperationalTask({ title: '   ', priority: 'normal' });
    expect(result.success).toBe(false);
  });

  it('creates the task at status "todo" and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ rpc: { data: 'TSK-2026-0001' }, from: { operational_tasks: [{ data: { id: 'task-1' } }] } })
    );

    const result = await createOperationalTask({ title: 'Follow up on invoice', priority: 'high' });

    expect(result.success).toBe(true);
    expect(result.id).toBe('task-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'create', module: 'operational_tasks', recordId: 'task-1' })
    );
  });
});

describe('updateOperationalTaskStatus — status transitions feeding the dashboard KPIs', () => {
  it('rejects a role without operations.tasks.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: operations.tasks.manage'));
    const result = await updateOperationalTaskStatus('task-1', 'blocked');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects a status value outside the catalog', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    // @ts-expect-error deliberately invalid status to exercise the guard
    const result = await updateOperationalTaskStatus('task-1', 'not_a_real_status');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('writes the new status (e.g. "blocked", counted by the Operations Dashboard) and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { operational_tasks: [{ data: null, error: null }] } }));

    const result = await updateOperationalTaskStatus('task-1', 'blocked');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'status_change', module: 'operational_tasks', recordId: 'task-1', newValue: { status: 'blocked' } })
    );
  });
});
