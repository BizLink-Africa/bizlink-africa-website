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

const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
vi.mock('@/lib/email/resend', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

interface QueueEntry {
  data: unknown;
  error?: unknown;
}

function makeSupabase(from: Record<string, QueueEntry[]>) {
  const queues: Record<string, QueueEntry[]> = Object.fromEntries(Object.entries(from).map(([k, v]) => [k, [...v]]));
  const insertCalls: { table: string; payload: unknown }[] = [];
  const tablesTouched: string[] = [];
  function builder(table: string) {
    tablesTouched.push(table);
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
      update: () => api,
      eq: () => api,
      single: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return {
    from: (table: string) => builder(table),
    __insertCalls: insertCalls,
    __tablesTouched: tablesTouched,
  } as never as { from: (t: string) => unknown; __insertCalls: typeof insertCalls; __tablesTouched: typeof tablesTouched };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createAccessReview, recordAccessReviewDecision } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createAccessReview — a recommendation record, never a role mutation', () => {
  it('rejects a role without access_reviews.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createAccessReview({ userLabel: 'jane@bizlinkafrica.net', excessiveAccessFlag: false });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('only ever writes to access_reviews — never roles, role_permissions, or staff_profiles', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'compliance@bizlinkafrica.net' });
    const supabase = makeSupabase({ access_reviews: [{ data: { id: 'ar-1' } }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createAccessReview({ userLabel: 'jane@bizlinkafrica.net', excessiveAccessFlag: false });

    expect(result.success).toBe(true);
    expect(supabase.__tablesTouched).toEqual(['access_reviews']);
    expect(supabase.__tablesTouched).not.toContain('roles');
    expect(supabase.__tablesTouched).not.toContain('role_permissions');
    expect(supabase.__tablesTouched).not.toContain('staff_profiles');
  });

  it('records the review with decision "pending" and audit-logs the creation', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'compliance@bizlinkafrica.net' });
    const supabase = makeSupabase({ access_reviews: [{ data: { id: 'ar-1' } }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    await createAccessReview({ userLabel: 'jane@bizlinkafrica.net', excessiveAccessFlag: false });

    expect(supabase.__insertCalls[0].payload).toMatchObject({ decision: 'pending', user_label: 'jane@bizlinkafrica.net' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'create', module: 'access_reviews' }));
  });

  it('sends a notification email when excessive access is flagged', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'compliance@bizlinkafrica.net' });
    const supabase = makeSupabase({
      access_reviews: [{ data: { id: 'ar-1' } }],
      company_settings: [{ data: { compliance_alert_email: 'security@bizlinkafrica.net' } }],
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    await createAccessReview({ userLabel: 'jane@bizlinkafrica.net', excessiveAccessFlag: true, findings: 'Has admin on 4 unrelated systems.' });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'security@bizlinkafrica.net', subject: expect.stringContaining('Excessive access flagged') })
    );
  });

  it('does not send a notification email when access is not flagged', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'compliance@bizlinkafrica.net' });
    const supabase = makeSupabase({ access_reviews: [{ data: { id: 'ar-1' } }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    await createAccessReview({ userLabel: 'jane@bizlinkafrica.net', excessiveAccessFlag: false });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('recordAccessReviewDecision — every decision is an audited event', () => {
  it('rejects a role without access_reviews.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await recordAccessReviewDecision('ar-1', 'approved');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid decision', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'compliance@bizlinkafrica.net' });
    const result = await recordAccessReviewDecision('ar-1', 'not_a_real_decision');
    expect(result.success).toBe(false);
  });

  it('records the decision and always writes an audit_logs entry', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'compliance@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ access_reviews: [{ data: null, error: null }] }));

    const result = await recordAccessReviewDecision('ar-1', 'revoke_recommended');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'decision', module: 'access_reviews', recordId: 'ar-1', newValue: { decision: 'revoke_recommended' } })
    );
  });
});
