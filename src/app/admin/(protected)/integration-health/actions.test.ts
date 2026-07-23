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

const { createIntegrationRecord, updateIntegrationStatus, updateIntegrationIncidentStatus } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createIntegrationRecord — permission gate', () => {
  it('rejects a role without integrations.manage (e.g. read-only CEO view access)', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createIntegrationRecord({ serviceType: 'M-Pesa', apiStatus: 'active' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid API status', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const result = await createIntegrationRecord({ serviceType: 'M-Pesa', apiStatus: 'not_a_real_status' });
    expect(result.success).toBe(false);
  });

  it('creates the record and audit-logs it when authorized', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ integration_health: [{ data: { id: 'int-1' } }] }));

    const result = await createIntegrationRecord({ serviceType: 'M-Pesa', apiStatus: 'active' });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'create', module: 'integration_health' }));
  });
});

describe('updateIntegrationIncidentStatus — integration alert workflow', () => {
  it('rejects a role without integrations.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateIntegrationIncidentStatus('int-1', 'investigating');
    expect(result.success).toBe(false);
  });

  it('rejects an invalid incident status', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    const result = await updateIntegrationIncidentStatus('int-1', 'not_a_real_incident_status');
    expect(result.success).toBe(false);
  });

  it('updates the incident status and audit-logs it, so a failing integration can be tracked through to resolution', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ integration_health: [{ data: null, error: null }] }));

    const result = await updateIntegrationIncidentStatus('int-1', 'investigating');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'update_incident_status', newValue: { incidentStatus: 'investigating' } })
    );
  });
});

describe('updateIntegrationStatus — the underlying signal that drives the failedIntegrations sidebar alert', () => {
  it('rejects a role without integrations.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateIntegrationStatus('int-1', 'failed');
    expect(result.success).toBe(false);
  });

  it('marks last_failed_request when moved to failed, and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'cto@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ integration_health: [{ data: null, error: null }] }));

    const result = await updateIntegrationStatus('int-1', 'failed');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'update_status', newValue: { apiStatus: 'failed' } }));
  });
});
