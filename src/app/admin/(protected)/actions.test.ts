// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequirePermission = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  verifyAdminSession: async () => ({ email: 'ceo@bizlinkafrica.net', id: 'user-1' }),
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Queue-based mock: each table gets a queue of canned responses, shifted in
// call order — lets a single test cover a multi-step action (like
// convertLeadToClient's existing-check -> fetch -> insert -> upsert ->
// update sequence) without a real database.
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
      upsert: () => api,
      eq: () => api,
      in: () => api,
      order: () => api,
      single: () => resolve(),
      maybeSingle: () => resolve(),
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

const { createLead, assignLead, convertLeadToClient, updateInquiry } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createLead — lead creation, permissions, audit', () => {
  it('rejects a role without leads.create', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: leads.create'));
    const result = await createLead({ fullName: 'Jane', businessName: 'Acme', email: 'jane@acme.com', phone: '0700000000' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('requires the core fields', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    const result = await createLead({ fullName: '', businessName: 'Acme', email: 'jane@acme.com', phone: '0700000000' });
    expect(result.success).toBe(false);
  });

  it('generates a lead number, inserts the lead, and audit-logs the creation', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        rpc: { data: 'LED-2026-0001' },
        from: { website_leads: [{ data: { id: 'lead-1' } }] },
      })
    );

    const result = await createLead({ fullName: 'Jane', businessName: 'Acme', email: 'jane@acme.com', phone: '0700000000' });

    expect(result.success).toBe(true);
    expect(result.id).toBe('lead-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'ops@bizlinkafrica.net', actionType: 'create', module: 'website_leads', recordId: 'lead-1' })
    );
  });
});

describe('assignLead — lead assignment, permissions, audit', () => {
  it('rejects a role without leads.assign (distinct from leads.update)', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: leads.assign'));
    const result = await assignLead('lead-1', 'staff-1');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('writes assigned_user_id and audit-logs the assignment', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { website_leads: [{ data: null, error: null }] } }));

    const result = await assignLead('lead-1', 'staff-1');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'assign', module: 'website_leads', recordId: 'lead-1', newValue: { assignedUserId: 'staff-1' } })
    );
  });
});

describe('convertLeadToClient — lead conversion, permissions, audit', () => {
  it('rejects a role without leads.convert', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: leads.convert'));
    const result = await convertLeadToClient('lead-1');
    expect(result.success).toBe(false);
  });

  it('is idempotent — returns the existing client without re-inserting if already converted', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { clients: [{ data: { id: 'client-existing' } }] } }));

    const result = await convertLeadToClient('lead-1');

    expect(result.success).toBe(true);
    expect(result.clientId).toBe('client-existing');
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('creates a client from the lead, generates a client number, and audit-logs the conversion', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({
        rpc: { data: 'CLI-2026-0001' },
        from: {
          clients: [{ data: null }, { data: { id: 'client-1' } }],
          website_leads: [
            { data: { id: 'lead-1', full_name: 'Jane', business_name: 'Acme', email: 'jane@acme.com', phone: '0700000000', assigned_user_id: 'staff-1' } },
            { data: null, error: null },
          ],
          onboarding_checklists: [{ data: null, error: null }],
        },
      })
    );

    const result = await convertLeadToClient('lead-1');

    expect(result.success).toBe(true);
    expect(result.clientId).toBe('client-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'convert_to_client', module: 'website_leads', recordId: 'lead-1' })
    );
  });
});

describe('updateInquiry — permission enforcement and audit logging', () => {
  it('rejects a role without leads.update', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: leads.update'));
    const result = await updateInquiry('lead-1', { stage: 'qualified' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid stage value', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    const result = await updateInquiry('lead-1', { stage: 'not_a_real_stage' });
    expect(result.success).toBe(false);
  });

  it('updates the lead and audit-logs the change for an authorized caller', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { website_leads: [{ data: null, error: null }] } }));

    const result = await updateInquiry('lead-1', { stage: 'qualified', leadScore: 75 });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ performedBy: 'ops@bizlinkafrica.net', actionType: 'update', module: 'website_leads', recordId: 'lead-1' })
    );
  });
});
