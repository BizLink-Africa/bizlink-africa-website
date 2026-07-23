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
  return { from: (table: string) => builder(table), __insertCalls: insertCalls, __updateCalls: updateCalls } as never as {
    from: (t: string) => unknown;
    __insertCalls: typeof insertCalls;
    __updateCalls: typeof updateCalls;
  };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createIncident, updateIncidentStatus, addIncidentUpdate } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createIncident — opens with status "open" regardless of input', () => {
  it('rejects a role without incidents.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createIncident({ title: 'Payment gateway down', severity: 'critical', affectedSystems: [], affectedClients: [] });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid severity', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const result = await createIncident({ title: 'x', severity: 'catastrophic', affectedSystems: [], affectedClients: [] });
    expect(result.success).toBe(false);
  });

  it('creates the incident and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const supabase = makeSupabase({ technical_incidents: [{ data: { id: 'inc-1' } }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createIncident({ title: 'Payment gateway down', severity: 'critical', affectedSystems: ['Payments'], affectedClients: [] });

    expect(result.success).toBe(true);
    expect(result.id).toBe('inc-1');
    expect(supabase.__insertCalls[0].payload).toMatchObject({ status: 'open', severity: 'critical' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'create', module: 'technical_incidents' }));
  });
});

describe('updateIncidentStatus — every status change writes a timeline entry', () => {
  it('rejects a role without incidents.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateIncidentStatus('inc-1', 'investigating');
    expect(result.success).toBe(false);
  });

  it('rejects an invalid status', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const result = await updateIncidentStatus('inc-1', 'not_a_real_status');
    expect(result.success).toBe(false);
  });

  it('updates the incident, inserts a matching timeline entry, and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const supabase = makeSupabase({
      technical_incidents: [{ data: null, error: null }],
      technical_incident_updates: [{ data: null, error: null }],
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await updateIncidentStatus('inc-1', 'investigating', 'Paging on-call.');

    expect(result.success).toBe(true);
    const incidentUpdate = supabase.__updateCalls.find((c) => c.table === 'technical_incidents');
    expect(incidentUpdate?.payload).toMatchObject({ status: 'investigating' });
    const timelineInsert = supabase.__insertCalls.find((c) => c.table === 'technical_incident_updates');
    expect(timelineInsert?.payload).toMatchObject({ incident_id: 'inc-1', note: 'Paging on-call.', status_at_update: 'investigating' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'update_status' }));
  });

  it('stamps resolved_at when the status moves to resolved', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const supabase = makeSupabase({
      technical_incidents: [{ data: null, error: null }],
      technical_incident_updates: [{ data: null, error: null }],
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await updateIncidentStatus('inc-1', 'resolved');

    expect(result.success).toBe(true);
    const incidentUpdate = supabase.__updateCalls.find((c) => c.table === 'technical_incidents');
    expect(incidentUpdate?.payload).toHaveProperty('resolved_at');
  });

  it('falls back to an auto-generated note when none is provided', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const supabase = makeSupabase({
      technical_incidents: [{ data: null, error: null }],
      technical_incident_updates: [{ data: null, error: null }],
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    await updateIncidentStatus('inc-1', 'monitoring');

    const timelineInsert = supabase.__insertCalls.find((c) => c.table === 'technical_incident_updates');
    expect(timelineInsert?.payload).toMatchObject({ note: 'Status changed to monitoring.' });
  });
});

describe('addIncidentUpdate — timeline note without a status change', () => {
  it('rejects a role without incidents.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await addIncidentUpdate('inc-1', 'Still investigating.');
    expect(result.success).toBe(false);
  });

  it('rejects an empty note', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const result = await addIncidentUpdate('inc-1', '   ');
    expect(result.success).toBe(false);
  });

  it('adds the note and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const supabase = makeSupabase({ technical_incident_updates: [{ data: null, error: null }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await addIncidentUpdate('inc-1', 'Root cause identified.');

    expect(result.success).toBe(true);
    expect(supabase.__insertCalls[0].payload).toMatchObject({ incident_id: 'inc-1', note: 'Root cause identified.' });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'add_timeline_update' }));
  });
});
