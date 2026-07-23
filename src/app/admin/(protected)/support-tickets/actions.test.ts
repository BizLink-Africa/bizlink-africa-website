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

function makeSupabase(config: { rpc?: QueueEntry; from: Record<string, QueueEntry[]> }) {
  const queues: Record<string, QueueEntry[]> = Object.fromEntries(Object.entries(config.from).map(([k, v]) => [k, [...v]]));
  const insertCalls: { table: string; payload: unknown }[] = [];
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
      update: () => api,
      eq: () => api,
      maybeSingle: () => resolve(),
      single: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: 'TCK-2026-0001', error: null }),
    __insertCalls: insertCalls,
  } as never as { from: (t: string) => unknown; rpc: () => Promise<unknown>; __insertCalls: typeof insertCalls };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createTicket, escalateTicket, assignTicket, addTicketMessage } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTicket — SLA deadlines computed from support_sla_rules at creation', () => {
  it('rejects a role without tickets.create', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createTicket({ title: 'Cannot log in', category: 'technical', priority: 'urgent' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('sets response/resolution deadlines from the matching SLA rule', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    const supabase = makeSupabase({
      rpc: { data: 'TCK-2026-0001' },
      from: {
        support_sla_rules: [{ data: { response_hours: 1, resolution_hours: 4 } }],
        support_tickets: [{ data: { id: 'ticket-1' } }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createTicket({ title: 'Cannot log in', category: 'technical', priority: 'urgent' });

    expect(result.success).toBe(true);
    const payload = supabase.__insertCalls[0].payload as { response_deadline: string; resolution_deadline: string };
    const responseMs = new Date(payload.response_deadline).getTime() - Date.now();
    const resolutionMs = new Date(payload.resolution_deadline).getTime() - Date.now();
    expect(responseMs).toBeGreaterThan(0.9 * 60 * 60 * 1000);
    expect(responseMs).toBeLessThan(1.1 * 60 * 60 * 1000);
    expect(resolutionMs).toBeGreaterThan(3.9 * 60 * 60 * 1000);
    expect(resolutionMs).toBeLessThan(4.1 * 60 * 60 * 1000);
  });
});

describe('escalateTicket — requires a target and a reason', () => {
  it('rejects a role without tickets.escalate', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await escalateTicket('ticket-1', { target: 'cfo', reason: 'Billing dispute' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects an empty reason', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    const result = await escalateTicket('ticket-1', { target: 'cfo', reason: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid target', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    // @ts-expect-error deliberately invalid target to exercise the guard
    const result = await escalateTicket('ticket-1', { target: 'not_a_real_target', reason: 'x' });
    expect(result.success).toBe(false);
  });

  it('escalates to the given target with the reason, and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { support_tickets: [{ data: null, error: null }] } }));

    const result = await escalateTicket('ticket-1', { target: 'cfo', reason: 'Billing dispute over invoice INV-2026-0004' });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'escalate', newValue: expect.objectContaining({ target: 'cfo' }) })
    );
  });
});

describe('assignTicket — permission gate', () => {
  it('rejects a role without tickets.assign', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await assignTicket('ticket-1', 'staff-1');
    expect(result.success).toBe(false);
  });

  it('assigns and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { support_tickets: [{ data: null, error: null }] } }));

    const result = await assignTicket('ticket-1', 'staff-1');
    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'assign' }));
  });
});

describe('addTicketMessage — internal-note privacy and first-response tracking', () => {
  it('rejects a role without tickets.update', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await addTicketMessage('ticket-1', { message: 'hello', isInternal: false });
    expect(result.success).toBe(false);
  });

  it('stores is_internal exactly as passed in, from a permission-checked action — not a client-controlled bypass', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: { support_ticket_messages: [{ data: { id: 'msg-1' } }] },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await addTicketMessage('ticket-1', { message: 'Internal-only note', isInternal: true });

    expect(result.success).toBe(true);
    expect(supabase.__insertCalls[0].payload).toMatchObject({ is_internal: true });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'add_internal_note' }));
  });

  it('stamps first_response_at on the ticket when the first client-visible reply is posted', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        support_ticket_messages: [{ data: { id: 'msg-2' } }],
        support_tickets: [{ data: { first_response_at: null } }, { data: null, error: null }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await addTicketMessage('ticket-1', { message: 'We are looking into this.', isInternal: false });

    expect(result.success).toBe(true);
    const ticketUpdateCall = supabase.__insertCalls.find((c) => c.table === 'support_ticket_messages');
    expect(ticketUpdateCall?.payload).toMatchObject({ is_internal: false });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'add_client_reply' }));
  });

  it('does not overwrite an existing first_response_at on a later client-visible reply', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'support@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        support_ticket_messages: [{ data: { id: 'msg-3' } }],
        support_tickets: [{ data: { first_response_at: '2026-07-01T00:00:00.000Z' } }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await addTicketMessage('ticket-1', { message: 'Follow-up reply', isInternal: false });
    expect(result.success).toBe(true);
  });
});
