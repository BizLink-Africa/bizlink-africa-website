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

function makeSupabase(config: { rpc?: { data: unknown; error?: unknown }; from: Record<string, Array<{ data: unknown; error?: unknown }>> }) {
  const queues: Record<string, Array<{ data: unknown; error?: unknown }>> = Object.fromEntries(
    Object.entries(config.from).map(([k, v]) => [k, [...v]])
  );
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
      single: () => resolve(),
      then: (onFulfilled: (v: { data: unknown; error: unknown }) => void) => resolve().then(onFulfilled),
    };
    return api;
  }
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: null, error: null }),
    __insertCalls: insertCalls,
  } as never as { from: (t: string) => unknown; rpc: () => Promise<unknown>; __insertCalls: typeof insertCalls };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createCampaign, updateCampaignDetails } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCampaign — validation', () => {
  it('rejects a role without campaigns.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createCampaign({ name: 'Ramadan Push', channels: ['facebook'], budget: 100000, currency: 'TZS' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('requires at least one channel', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    const result = await createCampaign({ name: 'Ramadan Push', channels: [], budget: 100000, currency: 'TZS' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/channel/i);
  });

  it('rejects an invalid campaign type', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    // @ts-expect-error deliberately invalid type to exercise the guard
    const result = await createCampaign({ name: 'Ramadan Push', type: 'not_a_real_type', channels: ['facebook'], budget: 100000, currency: 'TZS' });
    expect(result.success).toBe(false);
  });

  it('stores the first selected channel as the legacy `channel` column and all of them in `channels`', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    const supabase = makeSupabase({ from: { marketing_campaigns: [{ data: { id: 'camp-1' } }] } });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createCampaign({ name: 'Ramadan Push', channels: ['facebook', 'instagram'], budget: 100000, currency: 'TZS' });

    expect(result.success).toBe(true);
    expect(supabase.__insertCalls[0].payload).toMatchObject({ channel: 'facebook', channels: ['facebook', 'instagram'] });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'create', module: 'marketing_campaigns' }));
  });
});

describe('updateCampaignDetails — leads/conversions/revenue are never editable here', () => {
  it('rejects a role without campaigns.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateCampaignDetails('camp-1', { budget: 100000, actualSpend: 50000 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative budget or actual spend', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    const result = await updateCampaignDetails('camp-1', { budget: -1, actualSpend: 50000 });
    expect(result.success).toBe(false);
  });

  it('updates budget/actual spend and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'marketing@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { marketing_campaigns: [{ data: null, error: null }] } }));

    const result = await updateCampaignDetails('camp-1', { budget: 200000, actualSpend: 75000 });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'update_details', newValue: { budget: 200000, actualSpend: 75000 } })
    );
  });
});
