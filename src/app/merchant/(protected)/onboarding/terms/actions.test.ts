// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MERCHANT_ACKNOWLEDGEMENT_KEYS } from '@/data/legal';

const mockRequireActiveMerchant = vi.fn();
const mockVerifyMerchantSession = vi.fn();
vi.mock('@/lib/supabase/merchant-dal', () => ({
  requireActiveMerchant: (...args: unknown[]) => mockRequireActiveMerchant(...args),
  verifyMerchantSession: (...args: unknown[]) => mockVerifyMerchantSession(...args),
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'x-forwarded-for') return '196.192.1.10, 10.0.0.1';
      if (name === 'user-agent') return 'Mozilla/5.0 (test)';
      return null;
    },
  })),
}));

const insertCalls: { table: string; payload: unknown }[] = [];
let insertResult: { data: unknown; error: unknown } = {
  data: { id: 'acceptance-1', accepted_at: '2026-08-05T10:00:00.000Z' },
  error: null,
};

function makeRlsClient() {
  return {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertCalls.push({ table, payload });
        return {
          select: () => ({
            single: () => Promise.resolve(insertResult),
          }),
        };
      },
    }),
  };
}

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const SERVICE_CLIENT_MARKER = { __serviceRoleClient: true };
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => SERVICE_CLIENT_MARKER,
}));

const { acceptMerchantTerms } = await import('./actions');

const MERCHANT_PROFILE = {
  merchantUserId: 'mu-1',
  merchantId: 'merchant-1',
  businessName: 'Zanzibar Spice Traders Ltd',
  fullName: 'Amina Juma',
  role: 'representative',
  isActive: true,
};

const ALL_TRUE_ACKNOWLEDGEMENTS = Object.fromEntries(MERCHANT_ACKNOWLEDGEMENT_KEYS.map((k) => [k, true]));

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  insertResult = { data: { id: 'acceptance-1', accepted_at: '2026-08-05T10:00:00.000Z' }, error: null };
  mockRequireActiveMerchant.mockResolvedValue(MERCHANT_PROFILE);
  mockVerifyMerchantSession.mockResolvedValue({ id: 'auth-user-1', email: 'amina@example.com' });
  mockCreateClient.mockResolvedValue(makeRlsClient());
});

describe('acceptMerchantTerms — validation', () => {
  it('rejects when any acknowledgement is missing, without inserting anything', async () => {
    const incomplete = { ...ALL_TRUE_ACKNOWLEDGEMENTS, kyc_partner_understanding: false };
    const result = await acceptMerchantTerms(incomplete);

    expect(result.success).toBe(false);
    expect(insertCalls).toHaveLength(0);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects when an acknowledgement key is missing entirely', async () => {
    const { kyc_partner_understanding, ...withoutOne } = ALL_TRUE_ACKNOWLEDGEMENTS;
    void kyc_partner_understanding;
    const result = await acceptMerchantTerms(withoutOne);

    expect(result.success).toBe(false);
    expect(insertCalls).toHaveLength(0);
  });
});

describe('acceptMerchantTerms — records the acceptance correctly', () => {
  it('always derives merchant_id and accepted_by_user_id from the server session, never from input', async () => {
    const result = await acceptMerchantTerms(ALL_TRUE_ACKNOWLEDGEMENTS);

    expect(result.success).toBe(true);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe('merchant_terms_acceptances');
    expect(insertCalls[0].payload).toMatchObject({
      merchant_id: MERCHANT_PROFILE.merchantId,
      accepted_by_user_id: 'auth-user-1',
      accepted_by_name: MERCHANT_PROFILE.fullName,
      acknowledgements: ALL_TRUE_ACKNOWLEDGEMENTS,
    });
  });

  it('captures IP address and user agent from request headers', async () => {
    await acceptMerchantTerms(ALL_TRUE_ACKNOWLEDGEMENTS);

    expect(insertCalls[0].payload).toMatchObject({
      ip_address: '196.192.1.10',
      user_agent: 'Mozilla/5.0 (test)',
    });
  });

  it('includes a document hash', async () => {
    await acceptMerchantTerms(ALL_TRUE_ACKNOWLEDGEMENTS);

    const payload = insertCalls[0].payload as { document_hash?: string };
    expect(payload.document_hash).toBeTruthy();
    expect(typeof payload.document_hash).toBe('string');
  });

  it('writes the audit log entry through the service-role client, not the RLS-scoped one', async () => {
    await acceptMerchantTerms(ALL_TRUE_ACKNOWLEDGEMENTS);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'merchant_terms_acceptances',
        actionType: 'accept_merchant_terms',
        recordId: 'acceptance-1',
        client: SERVICE_CLIENT_MARKER,
      })
    );
  });

  it('returns a failure message and never calls logAuditEvent if the insert itself fails', async () => {
    insertResult = { data: null, error: { message: 'insert rejected' } };

    const result = await acceptMerchantTerms(ALL_TRUE_ACKNOWLEDGEMENTS);

    expect(result.success).toBe(false);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });
});
