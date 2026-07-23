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
  return {
    from: (table: string) => builder(table),
    __insertCalls: insertCalls,
    __updateCalls: updateCalls,
  } as never as { from: (t: string) => unknown; __insertCalls: typeof insertCalls; __updateCalls: typeof updateCalls };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { createRole, updateRoleDetails, setRoleActive, toggleRolePermission } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRole — every new role is custom, never a system role', () => {
  it('rejects without roles.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await createRole({ name: 'Regional Manager' });
    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects an empty name', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    const result = await createRole({ name: '   ' });
    expect(result.success).toBe(false);
  });

  it('creates the role with is_system=false and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    const supabase = makeSupabase({ roles: [{ data: { id: 'regional_manager' } }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createRole({ name: 'Regional Manager', description: 'Oversees a region' });

    expect(result.success).toBe(true);
    expect(supabase.__insertCalls[0]).toMatchObject({ table: 'roles', payload: expect.objectContaining({ is_system: false, name: 'Regional Manager' }) });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'create', module: 'roles' }));
  });

  it('clones permissions from the source role when cloneFromRoleId is given', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    const supabase = makeSupabase({
      roles: [{ data: { id: 'regional_manager' } }],
      role_permissions: [{ data: [{ permission_id: 'clients.view' }, { permission_id: 'leads.view' }] }, { data: null, error: null }],
    });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createRole({ name: 'Regional Manager', cloneFromRoleId: 'operations' });

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'clone' }));
    const clonedInsert = supabase.__insertCalls.find((c) => c.table === 'role_permissions');
    expect(clonedInsert?.payload).toEqual([
      { role_id: 'regional_manager', permission_id: 'clients.view' },
      { role_id: 'regional_manager', permission_id: 'leads.view' },
    ]);
  });

  it('surfaces a clean message on a duplicate role name', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    const supabase = makeSupabase({ roles: [{ data: null, error: { code: '23505', message: 'duplicate key' } }] });
    mockCreateClient.mockResolvedValueOnce(supabase);

    const result = await createRole({ name: 'CEO' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });
});

describe('updateRoleDetails — renaming a system role is blocked at the DB layer', () => {
  it('rejects without roles.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await updateRoleDetails('regional_manager', { name: 'New Name' });
    expect(result.success).toBe(false);
  });

  it('surfaces protect_system_roles() rename errors as a clean message', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ roles: [{ data: null, error: { message: 'System roles cannot be renamed' } }] }));

    const result = await updateRoleDetails('ceo', { name: 'Chief Everything Officer' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('System roles cannot be renamed.');
  });
});

describe('setRoleActive — Super Admin can never be deactivated', () => {
  it('rejects without roles.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('no'));
    const result = await setRoleActive('regional_manager', false);
    expect(result.success).toBe(false);
  });

  it('blocks deactivating super_admin at the app layer, before any DB call', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    const result = await setRoleActive('super_admin', false);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Super Admin role cannot be deactivated');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('surfaces protect_system_roles() deactivation errors as a clean message for other system roles', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ roles: [{ data: null, error: { message: 'System roles cannot be deactivated' } }] }));

    const result = await setRoleActive('ceo', false);

    expect(result.success).toBe(false);
    expect(result.message).toBe('System roles cannot be deactivated.');
  });

  it('activates/deactivates a custom role and audit-logs it', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    mockCreateClient.mockResolvedValueOnce(makeSupabase({ roles: [{ data: null, error: null }] }));

    const result = await setRoleActive('regional_manager', false);

    expect(result.success).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'deactivate', module: 'roles', recordId: 'regional_manager' }));
  });
});

describe('toggleRolePermission — super_admin is still locked (pre-existing guarantee)', () => {
  it('refuses to change super_admin permissions', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'admin@bizlinkafrica.net' });
    const result = await toggleRolePermission('super_admin', 'roles.manage', false);
    expect(result.success).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
