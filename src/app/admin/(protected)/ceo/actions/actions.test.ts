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

const mockSendEmail = vi.fn(async () => ({ success: true }));
vi.mock('@/lib/email/resend', () => ({
  sendEmail: () => mockSendEmail(),
}));

vi.mock('@/lib/email/templates', () => ({
  buildExecutiveDecisionEmail: () => ({ subject: 'Executive Decision', html: '<p>x</p>', text: 'x' }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockSupabaseFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: mockSupabaseFrom }),
}));

const { addExecutiveComment, assignFollowUp } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BIZLINK_NOTIFICATION_EMAIL = 'ceo@bizlinkafrica.net';
});

describe('addExecutiveComment — access control', () => {
  it('rejects a role without executive.actions.manage (e.g. operations) and writes no audit log', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: executive.actions.manage'));
    const result = await addExecutiveComment('contracts', 'c1', 'Contract X', '/admin/contracts/c1', 'Looks good');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('rejects an empty comment even for an authorized caller', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const result = await addExecutiveComment('contracts', 'c1', 'Contract X', '/admin/contracts/c1', '   ');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});

describe('addExecutiveComment — audit logging and secret redaction', () => {
  it('records who/what/when and sends a notification for an authorized (CEO/super_admin) caller', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const result = await addExecutiveComment('contracts', 'c1', 'Contract X', '/admin/contracts/c1', 'Looks good');

    expect(result.success).toBe(true);
    expect(mockRequirePermission).toHaveBeenCalledWith('executive.actions.manage');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        performedBy: 'ceo@bizlinkafrica.net',
        actionType: 'comment',
        module: 'contracts',
        recordId: 'c1',
        newValue: { comment: 'Looks good' },
      })
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('only ever logs an allow-listed { comment } field — never the full source record (sensitive fields stay hidden)', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    await addExecutiveComment('contracts', 'c1', 'Contract X', '/admin/contracts/c1', 'Contains no secrets, just this text');

    const loggedNewValue = mockLogAuditEvent.mock.calls[0][0].newValue;
    expect(Object.keys(loggedNewValue)).toEqual(['comment']);
  });

  it('skips sending a notification if no recipient is configured, without failing the action', async () => {
    delete process.env.BIZLINK_NOTIFICATION_EMAIL;
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const result = await addExecutiveComment('contracts', 'c1', 'Contract X', '/admin/contracts/c1', 'Looks good');
    expect(result.success).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('assignFollowUp — access control, audit logging, notifications', () => {
  it('rejects a role without executive.actions.manage and never touches the database', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: executive.actions.manage'));
    const result = await assignFollowUp({
      sourceModule: 'contracts',
      sourceId: 'c1',
      itemTitle: 'Contract X',
      href: '/admin/contracts/c1',
      actionType: 'assign',
      assignedTo: 'ops@bizlinkafrica.net',
    });
    expect(result.success).toBe(false);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('requires a non-empty assignee', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const result = await assignFollowUp({
      sourceModule: 'contracts',
      sourceId: 'c1',
      itemTitle: 'Contract X',
      href: '/admin/contracts/c1',
      actionType: 'assign',
      assignedTo: '   ',
    });
    expect(result.success).toBe(false);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it('creates a follow-up row, records the CEO + timestamp via the audit log, and notifies on escalate', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ceo@bizlinkafrica.net' });
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'fu1' }, error: null }),
    };
    mockSupabaseFrom.mockReturnValue(insertChain);

    const result = await assignFollowUp({
      sourceModule: 'contracts',
      sourceId: 'c1',
      itemTitle: 'Contract X',
      href: '/admin/contracts/c1',
      actionType: 'escalate',
      assignedTo: 'ceo2@bizlinkafrica.net',
      note: 'Please prioritize',
    });

    expect(result.success).toBe(true);
    expect(mockSupabaseFrom).toHaveBeenCalledWith('executive_follow_ups');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'ceo@bizlinkafrica.net', actionType: 'escalate', module: 'contracts', recordId: 'c1' })
    );
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});
