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

function makeSupabase(config: { rpc?: QueueEntry; from: Record<string, QueueEntry[]> }) {
  const queues: Record<string, QueueEntry[]> = Object.fromEntries(Object.entries(config.from).map(([k, v]) => [k, [...v]]));
  const insertCalls: { table: string; payload: unknown }[] = [];
  const updateCalls: { table: string; payload: unknown }[] = [];
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
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: 'SI-2026-0001', error: null }),
    __insertCalls: insertCalls,
    __updateCalls: updateCalls,
  } as never as { from: (t: string) => unknown; rpc: () => Promise<unknown>; __insertCalls: typeof insertCalls; __updateCalls: typeof updateCalls };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createSecurityIncident, updateSecurityIncidentStatus, addSecurityIncidentUpdate } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSecurityIncident — notifies on open', () => {
  it('rejects a role without security_incidents.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createSecurityIncident({ title: 'Credential stuffing detected', severity: 'high', affectedSystems: [], affectedUsers: [] });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('creates the incident, audit-logs it, and sends a notification email', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'security@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        security_incidents: [{ data: { id: 'inc-1' } }],
        company_settings: [{ data: { incident_alert_email: 'ceo@bizlinkafrica.net' } }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createSecurityIncident({ title: 'Credential stuffing detected', severity: 'high', affectedSystems: ['Login'], affectedUsers: [] });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'create', module: 'security_incidents' }));
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ceo@bizlinkafrica.net' }));
  });
});

describe('updateSecurityIncidentStatus — every status change writes a timeline entry', () => {
  it('rejects a role without security_incidents.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateSecurityIncidentStatus('inc-1', 'investigating');
    expect(result.success).toBe(false);
  });

  it('updates status, inserts a matching timeline entry, and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'security@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        security_incidents: [{ data: null, error: null }],
        security_incident_updates: [{ data: null, error: null }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await updateSecurityIncidentStatus('inc-1', 'contained', 'Blocked source IP range.');

    expect(result.success).toBe(true);
    const incidentUpdate = supabase.__updateCalls.find((c) => c.table === 'security_incidents');
    expect(incidentUpdate?.payload).toMatchObject({ status: 'contained' });
    const timelineInsert = supabase.__insertCalls.find((c) => c.table === 'security_incident_updates');
    expect(timelineInsert?.payload).toMatchObject({ incident_id: 'inc-1', note: 'Blocked source IP range.', status_at_update: 'contained' });
  });

  it('stamps resolved_at when the status moves to resolved', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'security@bizlinkafrica.net' });
    const supabase = makeSupabase({
      from: {
        security_incidents: [{ data: null, error: null }],
        security_incident_updates: [{ data: null, error: null }],
      },
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    await updateSecurityIncidentStatus('inc-1', 'resolved');

    const incidentUpdate = supabase.__updateCalls.find((c) => c.table === 'security_incidents');
    expect(incidentUpdate?.payload).toHaveProperty('resolved_at');
  });
});

describe('addSecurityIncidentUpdate — timeline note without a status change', () => {
  it('rejects an empty note', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'security@bizlinkafrica.net' });
    const result = await addSecurityIncidentUpdate('inc-1', '   ');
    expect(result.success).toBe(false);
  });

  it('adds the note and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'security@bizlinkafrica.net' });
    const supabase = makeSupabase({ from: { security_incident_updates: [{ data: null, error: null }] } });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await addSecurityIncidentUpdate('inc-1', 'Escalated to on-call.');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'add_timeline_update' }));
  });
});
