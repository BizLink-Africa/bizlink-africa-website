// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockRequirePermission = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockRpc = vi.fn();
const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const { addProvisioningCredential, saveProvisioningProfile } = await import('./actions');

const ORIGINAL_ENV = process.env.PROVISIONING_ENCRYPTION_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PROVISIONING_ENCRYPTION_KEY = 'test-key-for-unit-tests';
  mockCreateClient.mockResolvedValue({ rpc: mockRpc, from: () => ({ upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'prov-1' }, error: null }) }) }) }) });
});

afterEach(() => {
  process.env.PROVISIONING_ENCRYPTION_KEY = ORIGINAL_ENV;
});

describe('addProvisioningCredential — the only write path for secrets', () => {
  const validInput = {
    provisioningId: 'prov-1',
    clientId: 'client-1',
    credentialType: 'api_key' as const,
    label: 'Selcom Sandbox Key',
    secretValue: 'sk_live_abcdefgh1234wxyz',
  };

  it('rejects a role without provisioning.manage, and never calls the encryption RPC', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: provisioning.manage'));
    const result = await addProvisioningCredential(validInput);
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects an unconfigured server without ever touching the plaintext secret', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    delete process.env.PROVISIONING_ENCRYPTION_KEY;
    const result = await addProvisioningCredential(validInput);
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rejects a missing label or secret before calling the RPC', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    const result = await addProvisioningCredential({ ...validInput, secretValue: '' });
    expect(result.success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sends only a masked preview alongside the encrypted-at-the-DB secret, never the raw value as a separate field', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await addProvisioningCredential(validInput);

    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      'insert_provisioning_credential',
      expect.objectContaining({
        p_provisioning_id: 'prov-1',
        p_credential_type: 'api_key',
        p_label: 'Selcom Sandbox Key',
        p_secret: 'sk_live_abcdefgh1234wxyz',
        p_encryption_key: 'test-key-for-unit-tests',
      })
    );
    const call = mockRpc.mock.calls[0][1] as { p_masked_preview: string };
    // Masked preview reveals only the last 4 characters — never the full secret.
    expect(call.p_masked_preview.endsWith('wxyz')).toBe(true);
    expect(call.p_masked_preview).not.toContain('sk_live_abcdefgh1234wxyz');
    expect(call.p_masked_preview.slice(0, -4)).toMatch(/^•+$/);
  });

  it('propagates an RPC failure (e.g. missing provisioning.manage enforced at the DB layer) as a generic failure message', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });

    const result = await addProvisioningCredential(validInput);
    expect(result.success).toBe(false);
  });
});

describe('saveProvisioningProfile — permission gate', () => {
  it('rejects a role without provisioning.manage', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Missing required permission: provisioning.manage'));
    const result = await saveProvisioningProfile({
      clientId: 'client-1',
      enabledModules: ['crm'],
      trainingStatus: 'not_started',
      handoverStatus: 'not_started',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid status value', async () => {
    mockRequirePermission.mockResolvedValueOnce({ email: 'ops@bizlinkafrica.net' });
    const result = await saveProvisioningProfile({
      clientId: 'client-1',
      enabledModules: [],
      // @ts-expect-error deliberately invalid status to exercise the guard
      trainingStatus: 'bogus',
      handoverStatus: 'not_started',
    });
    expect(result.success).toBe(false);
  });
});
