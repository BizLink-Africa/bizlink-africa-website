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
  return {
    from: (table: string) => builder(table),
    rpc: () => Promise.resolve(config.rpc ?? { data: 'ONB-2026-0001', error: null }),
  } as never;
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createOnboardingCase, updateOnboardingCaseStage } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOnboardingCase — permissions and linkage', () => {
  it('rejects a role without onboarding.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: onboarding.manage'));
    const result = await createOnboardingCase({ clientId: 'client-1' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('requires a client or a lead to be linked', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    const result = await createOnboardingCase({});
    expect(result.success).toBe(false);
  });

  it('creates the case at stage "new_inquiry" and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(
      makeSupabase({ rpc: { data: 'ONB-2026-0001' }, from: { onboarding_cases: [{ data: { id: 'case-1' } }] } })
    );

    const result = await createOnboardingCase({ clientId: 'client-1' });

    expect(result.success).toBe(true);
    expect(result.id).toBe('case-1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'create', module: 'onboarding_cases', recordId: 'case-1' })
    );
  });
});

describe('updateOnboardingCaseStage — 20-stage pipeline transitions', () => {
  it('rejects a role without onboarding.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: onboarding.manage'));
    const result = await updateOnboardingCaseStage('case-1', 'contract_review');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects a stage value outside the 20-stage catalog', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    // @ts-expect-error deliberately invalid stage to exercise the guard
    const result = await updateOnboardingCaseStage('case-1', 'not_a_real_stage');
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('writes the new stage and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ from: { onboarding_cases: [{ data: null, error: null }] } }));

    const result = await updateOnboardingCaseStage('case-1', 'activated');

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'stage_change', module: 'onboarding_cases', recordId: 'case-1', newValue: { stage: 'activated' } })
    );
  });
});
