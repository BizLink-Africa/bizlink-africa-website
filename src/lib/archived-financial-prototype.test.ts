// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetStaffProfile = vi.fn();
vi.mock('@/lib/supabase/dal', () => ({
  getStaffProfile: (...args: unknown[]) => mockGetStaffProfile(...args),
}));

const {
  isArchivedFinancialPrototypeEnabled,
  checkArchivedFinancialPrototypeAccess,
  assertArchivedFinancialPrototypeReadOnly,
  isBizlinkManagingMerchantSettlements,
  assertMerchantSettlementsNotBizLinkManaged,
  MERCHANT_PAYOUTS_NOT_HANDLED_MESSAGE,
} = await import('./archived-financial-prototype');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.BIZLINK_MANAGES_MERCHANT_SETTLEMENTS;
  delete process.env.ARCHIVED_FINANCIAL_PROTOTYPE_ENABLED;
});

// The confirmed operating model: every merchant holds and manages their
// own payment account/wallet/till and settles directly with their
// approved payment partner. BizLink Africa does not receive, hold,
// control, reconcile, disburse or settle merchant funds.
describe('BIZLINK_MANAGES_MERCHANT_SETTLEMENTS — central flag', () => {
  it('defaults to false when unset', () => {
    expect(isBizlinkManagingMerchantSettlements()).toBe(false);
  });

  it('is false for any value other than exactly "true"', () => {
    for (const value of ['false', 'FALSE', '', '0', 'yes', '1']) {
      process.env.BIZLINK_MANAGES_MERCHANT_SETTLEMENTS = value;
      expect(isBizlinkManagingMerchantSettlements()).toBe(false);
    }
  });

  it('is true only for exactly "true" (case-insensitive, trimmed)', () => {
    process.env.BIZLINK_MANAGES_MERCHANT_SETTLEMENTS = ' TRUE ';
    expect(isBizlinkManagingMerchantSettlements()).toBe(true);
  });
});

describe('assertMerchantSettlementsNotBizLinkManaged — the central server-side gate', () => {
  it('always throws the exact required message', async () => {
    await expect(assertMerchantSettlementsNotBizLinkManaged()).rejects.toThrow(
      MERCHANT_PAYOUTS_NOT_HANDLED_MESSAGE
    );
    expect(MERCHANT_PAYOUTS_NOT_HANDLED_MESSAGE).toBe(
      'Merchant payouts are not handled by BizLink Africa. Settlement is managed directly by each merchant through the approved payment partner.'
    );
  });

  it('still blocks even if BIZLINK_MANAGES_MERCHANT_SETTLEMENTS is misconfigured to "true" — this is a permanent business-model decision, not a bypassable toggle', async () => {
    process.env.BIZLINK_MANAGES_MERCHANT_SETTLEMENTS = 'true';
    await expect(assertMerchantSettlementsNotBizLinkManaged()).rejects.toThrow(
      MERCHANT_PAYOUTS_NOT_HANDLED_MESSAGE
    );
  });
});

describe('assertArchivedFinancialPrototypeReadOnly — the broader archived-module guard', () => {
  it('always throws', async () => {
    await expect(assertArchivedFinancialPrototypeReadOnly()).rejects.toThrow(/archived and permanently read-only/);
  });
});

describe('checkArchivedFinancialPrototypeAccess — merchant users cannot access archived finance routes', () => {
  it('rejects with "unauthenticated" when there is no staff_profiles row — the exact situation for a merchant-portal user (merchant_users, not staff_profiles)', async () => {
    mockGetStaffProfile.mockResolvedValue(null);
    const result = await checkArchivedFinancialPrototypeAccess();
    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
  });

  it('rejects an inactive staff row the same way', async () => {
    mockGetStaffProfile.mockResolvedValue({ role: 'super_admin', is_active: false, roleName: 'Super Admin' });
    const result = await checkArchivedFinancialPrototypeAccess();
    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
  });

  it('rejects a real staff member who is not super_admin', async () => {
    mockGetStaffProfile.mockResolvedValue({ role: 'cfo', is_active: true, roleName: 'CFO' });
    const result = await checkArchivedFinancialPrototypeAccess();
    expect(result).toEqual({ ok: false, reason: 'not_super_admin' });
  });

  it('allows a super_admin when the flag is enabled', async () => {
    mockGetStaffProfile.mockResolvedValue({ role: 'super_admin', is_active: true, roleName: 'Super Admin' });
    const result = await checkArchivedFinancialPrototypeAccess();
    expect(result).toEqual({ ok: true });
  });

  it('rejects everyone, including super_admin, when the flag is explicitly disabled', async () => {
    process.env.ARCHIVED_FINANCIAL_PROTOTYPE_ENABLED = 'false';
    mockGetStaffProfile.mockResolvedValue({ role: 'super_admin', is_active: true, roleName: 'Super Admin' });
    const result = await checkArchivedFinancialPrototypeAccess();
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });
});

describe('isArchivedFinancialPrototypeEnabled', () => {
  it('defaults to true (viewable) so audit history remains accessible to Super Admin', () => {
    expect(isArchivedFinancialPrototypeEnabled()).toBe(true);
  });

  it('is false only when explicitly set to "false"', () => {
    process.env.ARCHIVED_FINANCIAL_PROTOTYPE_ENABLED = 'false';
    expect(isArchivedFinancialPrototypeEnabled()).toBe(false);
  });
});
