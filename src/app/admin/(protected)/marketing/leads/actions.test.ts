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
      limit: () => api,
      maybeSingle: () => resolve(),
      single: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: 'LED-2026-0001', error: null }),
  } as never;
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createMarketingLead, setLeadQualification } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

const validInput = {
  fullName: 'Amina Hassan',
  businessName: 'Amina Traders',
  email: 'amina@example.com',
  phone: '+255700000000',
};

describe('createMarketingLead — duplicate prevention', () => {
  it('rejects a role without leads.create', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: leads.create'));
    const result = await createMarketingLead(validInput);
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects when an existing lead has the same email', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        from: {
          website_leads: [
            { data: { id: 'existing-lead-1', business_name: 'Amina Traders (existing)' } }, // email lookup
            { data: null }, // phone lookup
          ],
        },
      })
    );

    const result = await createMarketingLead(validInput);

    expect(result.success).toBe(false);
    expect(result.duplicateLeadId).toBe('existing-lead-1');
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects when an existing lead has the same phone (different email)', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        from: {
          website_leads: [
            { data: null }, // email lookup — no match
            { data: { id: 'existing-lead-2', business_name: 'Same Phone Co' } }, // phone lookup — match
          ],
        },
      })
    );

    const result = await createMarketingLead(validInput);

    expect(result.success).toBe(false);
    expect(result.duplicateLeadId).toBe('existing-lead-2');
  });

  it('creates the lead and audit-logs it when no duplicate exists', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        rpc: { data: 'LED-2026-0001' },
        from: {
          website_leads: [
            { data: null }, // email lookup
            { data: null }, // phone lookup
            { data: { id: 'new-lead-1' } }, // insert
          ],
        },
      })
    );

    const result = await createMarketingLead(validInput);

    expect(result.success).toBe(true);
    expect(result.id).toBe('new-lead-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'create', module: 'website_leads', recordId: 'new-lead-1' })
    );
  });
});

describe('setLeadQualification — MQL/SQL toggle', () => {
  it('rejects a role without leads.update', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await setLeadQualification('lead-1', 'is_mql', true);
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('sets is_mql and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { website_leads: [{ data: null, error: null }] } }));

    const result = await setLeadQualification('lead-1', 'is_mql', true);

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'set_mql', newValue: { is_mql: true } }));
  });
});
