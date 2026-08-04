// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRequirePermission = vi.fn();
const mockVerifyAdminSession = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  verifyAdminSession: (...args: unknown[]) => mockVerifyAdminSession(...args),
}));

const mockHasRecentReauth = vi.fn();
vi.mock('@/lib/supabase/reauth', () => ({
  hasRecentReauth: (...args: unknown[]) => mockHasRecentReauth(...args),
  REAUTH_PURPOSE: 'beneficiary_access',
  REAUTH_TTL_MINUTES: 10,
}));

const mockLogAuditEvent = vi.fn();
vi.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockSendEmail = vi.fn();
vi.mock('@/lib/email/resend', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockLookupRecipientAccount = vi.fn();
vi.mock('@/lib/selcom/account-lookup', () => ({
  lookupRecipientAccount: (...args: unknown[]) => mockLookupRecipientAccount(...args),
}));

vi.mock('@/lib/selcom/errors', () => ({
  isSelcomError: () => false,
}));

const mockRpc = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockInsert = vi.fn();
const mockCreateClient = vi.fn();

function makeSupabase() {
  const rpcChain = {
    select: () => rpcChain,
    single: () => Promise.resolve({ data: null, error: null }),
  };
  return {
    rpc: (...args: unknown[]) => {
      mockRpc(...args);
      return rpcChain;
    },
    from: () => ({
      insert: mockInsert,
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

const {
  requestBeneficiaryChange,
  approveBeneficiaryChangeRequest,
  rejectBeneficiaryChangeRequest,
} = await import('./actions');
const { lookupBeneficiaryAccount, confirmLookupNameMatch } = await import('./lookup-actions');
const { reauthenticateForBeneficiaries } = await import('./reauth-actions');

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ email: 'compliance@example.com' });
  mockVerifyAdminSession.mockResolvedValue({ id: 'staff-1', email: 'compliance@example.com' });
  mockHasRecentReauth.mockResolvedValue(true);
  mockRpc.mockReturnValue(undefined);
  mockInsert.mockResolvedValue({ error: null });
  mockSignInWithPassword.mockResolvedValue({ error: null });
  mockCreateClient.mockReturnValue(makeSupabase());
  process.env.BENEFICIARY_ENCRYPTION_KEY = 'test-key';
});

// Merchant Beneficiaries exists to prepare/verify a payout destination for
// BizLink-initiated disbursement. The confirmed operating model has each
// merchant supply and maintain their own settlement instructions directly
// with the approved payment partner, so BizLink Africa no longer needs to
// hold or manage this data for payout purposes. Every exported action in
// ./actions.ts, ./lookup-actions.ts and ./reauth-actions.ts calls
// assertArchivedFinancialPrototypeReadOnly() as its very first statement
// (see src/lib/archived-financial-prototype.ts), so every one of them must
// fail unconditionally, before ever reaching a permission check, the
// re-authentication check, or the Supabase/Selcom mock layer — regardless
// of what the caller's permissions or re-auth status are. See
// src/app/admin/(protected)/chargebacks/actions.test.ts for the sibling
// module this pattern was first applied to.
describe('merchant beneficiaries are an archived financial prototype — always blocked', () => {
  const ARCHIVED_MESSAGE =
    'This module is archived and permanently read-only. BizLink Africa does not handle merchant funds or settlements.';

  const cases: [string, () => Promise<{ success: boolean; message?: string }>][] = [
    [
      'requestBeneficiaryChange',
      () =>
        requestBeneficiaryChange({
          merchantId: 'merchant-1',
          requestType: 'add',
          destinationValue: '0700000000',
          changeReason: 'onboarding',
        }),
    ],
    ['approveBeneficiaryChangeRequest', () => approveBeneficiaryChangeRequest('req-1', 'merchant-1', 'add', 'looks good')],
    ['rejectBeneficiaryChangeRequest', () => rejectBeneficiaryChangeRequest('req-1', 'merchant-1', 'insufficient evidence')],
    [
      'lookupBeneficiaryAccount',
      () =>
        lookupBeneficiaryAccount({
          merchantId: 'merchant-1',
          institutionCode: 'CRDB',
          account: '0700000000',
        }),
    ],
    ['confirmLookupNameMatch', () => confirmLookupNameMatch('lookup-1', true, 'matches', 'merchant-1')],
    ['reauthenticateForBeneficiaries', () => reauthenticateForBeneficiaries('correct-password')],
  ];

  for (const [name, action] of cases) {
    it(`${name} is permanently blocked, even when the caller has permission and a fresh re-auth`, async () => {
      const result = await action();
      expect(result.success).toBe(false);
      expect(result.message).toBe(ARCHIVED_MESSAGE);
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
      expect(mockLookupRecipientAccount).not.toHaveBeenCalled();
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  }

  it('never reaches the permission check either — a caller with no permission at all gets the same archived message', async () => {
    mockRequirePermission.mockRejectedValue(new Error('no'));
    const result = await requestBeneficiaryChange({
      merchantId: 'merchant-1',
      requestType: 'add',
      destinationValue: '0700000000',
      changeReason: 'onboarding',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe(ARCHIVED_MESSAGE);
    expect(mockRequirePermission).not.toHaveBeenCalled();
  });

  it('never reaches the re-authentication check either — even a stale/absent re-auth gets the same archived message', async () => {
    mockHasRecentReauth.mockResolvedValue(false);
    const result = await lookupBeneficiaryAccount({
      merchantId: 'merchant-1',
      institutionCode: 'CRDB',
      account: '0700000000',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe(ARCHIVED_MESSAGE);
    expect(mockHasRecentReauth).not.toHaveBeenCalled();
  });

  it('reauthenticateForBeneficiaries never verifies the session or checks the password either', async () => {
    const result = await reauthenticateForBeneficiaries('correct-password');
    expect(result.success).toBe(false);
    expect(result.message).toBe(ARCHIVED_MESSAGE);
    expect(mockVerifyAdminSession).not.toHaveBeenCalled();
  });
});
