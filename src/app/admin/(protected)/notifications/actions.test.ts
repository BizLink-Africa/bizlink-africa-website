// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequirePermission = vi.fn();
const mockVerifyAdminSession = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  verifyAdminSession: (...args: unknown[]) => mockVerifyAdminSession(...args),
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function makeSupabase(result: { data: unknown; error: unknown }) {
  const insertCalls: unknown[] = [];
  const upsertCalls: unknown[] = [];
  const api = {
    select: () => api,
    insert: (payload: unknown) => {
      insertCalls.push(payload);
      return api;
    },
    upsert: (payload: unknown, options: unknown) => {
      upsertCalls.push({ payload, options });
      return Promise.resolve(result);
    },
    eq: () => api,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  };
  return { from: () => api, __insertCalls: insertCalls, __upsertCalls: upsertCalls } as never as {
    from: () => unknown;
    __insertCalls: unknown[];
    __upsertCalls: unknown[];
  };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createNotification, markNotificationRead } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createNotification — broadcast requires notifications.manage', () => {
  it('rejects without notifications.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createNotification({ title: 'x', message: 'y', priority: 'normal', department: '' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid priority', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'super@bizlinkafrica.net' });
    const result = await createNotification({ title: 'x', message: 'y', priority: 'critical', department: '' });
    expect(result.success).toBe(false);
  });

  it('inserts and audit-logs a valid broadcast', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'super@bizlinkafrica.net' });
    const supabase = makeSupabase({ data: { id: 'notif-1' }, error: null });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createNotification({ title: 'Heads up', message: 'Body text', priority: 'high', department: 'Finance' });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'admin_notifications', recordId: 'notif-1', actionType: 'broadcast' })
    );
  });
});

describe('markNotificationRead — read receipt is insert-only, never an update', () => {
  it('rejects without notifications.view', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await markNotificationRead('notif-1');
    expect(result.success).toBe(false);
  });

  it('upserts with ignoreDuplicates so a repeat click never attempts an UPDATE', async () => {
    mockRequirePermission.mockResolvedValueOnce({ id: 'user-1', email: 'staff@bizlinkafrica.net' });
    const supabase = makeSupabase({ data: { id: 'staff-1' }, error: null });
    // First call inside markNotificationRead resolves staff id via maybeSingle,
    // second call performs the upsert on admin_notification_reads.
    supabase.from = () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'staff-1' } }) }) }),
      upsert: (payload: unknown, options: unknown) => {
        supabase.__upsertCalls.push({ payload, options });
        return Promise.resolve({ data: null, error: null });
      },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const result = await markNotificationRead('notif-1');

    expect(result.success).toBe(true);
    expect(supabase.__upsertCalls[0]).toMatchObject({
      options: expect.objectContaining({ ignoreDuplicates: true }),
    });
  });
});
