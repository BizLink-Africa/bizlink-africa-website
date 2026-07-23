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

const { createFollowUp, completeFollowUp } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

const validInput = {
  followUpDate: '2026-08-01',
  leadId: 'lead-1',
  communicationType: 'call',
};

describe('createFollowUp — reminders and linkage', () => {
  it('rejects a role without crm.followups.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: crm.followups.manage'));
    const result = await createFollowUp(validInput);
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('requires a follow-up date', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    const result = await createFollowUp({ ...validInput, followUpDate: '' });
    expect(result.success).toBe(false);
  });

  it('requires a client or a lead to be linked', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    const result = await createFollowUp({ ...validInput, leadId: undefined, clientId: undefined });
    expect(result.success).toBe(false);
  });

  it('creates the follow-up scheduled and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { crm_follow_ups: [{ data: { id: 'fu-1' } }] } }));

    const result = await createFollowUp(validInput);

    expect(result.success).toBe(true);
    expect(result.id).toBe('fu-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'create', module: 'crm_follow_ups', recordId: 'fu-1', newValue: { followUpDate: '2026-08-01' } })
    );
  });
});

describe('completeFollowUp — status transitions', () => {
  it('rejects a role without crm.followups.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: crm.followups.manage'));
    const result = await completeFollowUp('fu-1', 'completed');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('marks the follow-up completed with a result and audit-logs a status-specific action type', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'sales@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { crm_follow_ups: [{ data: null, error: null }] } }));

    const result = await completeFollowUp('fu-1', 'completed', 'Spoke with client, interested.', 'Send proposal');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'status_completed',
        module: 'crm_follow_ups',
        recordId: 'fu-1',
        newValue: { status: 'completed', result: 'Spoke with client, interested.', nextAction: 'Send proposal' },
      })
    );
  });
});
