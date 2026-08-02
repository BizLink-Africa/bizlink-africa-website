// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const getAccountBalanceMock = vi.hoisted(() => vi.fn());
vi.mock('./balance', () => ({ getAccountBalance: getAccountBalanceMock }));

import { refreshSelcomBalance, getDisbursementBalanceDashboard } from './balance-service';
import { SelcomApiError } from './errors';

beforeEach(() => {
  getAccountBalanceMock.mockReset();
});

function makeRpcClient() {
  return { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
}

describe('refreshSelcomBalance — the only place the raw Selcom balance response is read', () => {
  it('masks the account number before returning anything to the caller', async () => {
    getAccountBalanceMock.mockResolvedValue({
      data: { accountNumber: '7545037522515', currency: 'TZS', availableBalance: 12000000, active: true },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'corr-1',
    });
    const supabase = makeRpcClient();

    const outcome = await refreshSelcomBalance(supabase, { triggerType: 'manual', batchId: null, performedBy: 'staff@bizlink.africa' });

    expect(outcome.querySucceeded).toBe(true);
    expect(outcome.maskedAccountNumber).toBe('****2515');
    expect(outcome.maskedAccountNumber).not.toBe('7545037522515');
    expect(outcome.availableBalance).toBe(12000000);
    expect(outcome.accountActive).toBe(true);
  });

  it('records the check via record_selcom_balance_check with the correct trigger_type and batch_id', async () => {
    getAccountBalanceMock.mockResolvedValue({
      data: { accountNumber: '7545037522515', currency: 'TZS', availableBalance: 12000000, active: true },
      result: 'SUCCESS',
      resultCode: '000',
      correlationId: 'corr-1',
    });
    const supabase = makeRpcClient();

    await refreshSelcomBalance(supabase, { triggerType: 'batch_approval', batchId: 'batch-1', performedBy: 'staff@bizlink.africa' });

    expect(supabase.rpc).toHaveBeenCalledWith('record_selcom_balance_check', expect.objectContaining({
      p_query_succeeded: true,
      p_available_balance: 12000000,
      p_account_active: true,
      p_currency: 'TZS',
      p_trigger_type: 'batch_approval',
      p_batch_id: 'batch-1',
      p_performed_by: 'staff@bizlink.africa',
    }));
  });

  it('a failed Selcom call still records the attempt (query_succeeded: false), never fabricating a balance', async () => {
    getAccountBalanceMock.mockRejectedValue(new SelcomApiError('Account not found', 404, null, '404', 'FAIL'));
    const supabase = makeRpcClient();

    const outcome = await refreshSelcomBalance(supabase, { triggerType: 'manual', batchId: null, performedBy: 'staff@bizlink.africa' });

    expect(outcome.querySucceeded).toBe(false);
    expect(outcome.availableBalance).toBeNull();
    expect(outcome.maskedAccountNumber).toBeNull();
    expect(outcome.errorMessage).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith('record_selcom_balance_check', expect.objectContaining({
      p_query_succeeded: false,
      p_available_balance: null,
    }));
  });
});

describe('getDisbursementBalanceDashboard — server-computed figures, never client-trusted', () => {
  function makeFromClient(overrides: Record<string, unknown> = {}) {
    const tables: Record<string, unknown> = {
      selcom_balance_snapshot: {
        available_balance: '10000000.00',
        account_active: true,
        currency: 'TZS',
        checked_at: '2026-08-02T10:00:00.000Z',
        checked_by: 'staff@bizlink.africa',
        low_balance_threshold: '2000000.00',
      },
      merchant_payouts: [{ amount: '1000000.00' }, { amount: '500000.50' }],
      selcom_balance_reservations: [
        { id: 'r1', batch_id: 'batch-1', reserved_amount: '3000000.00', status: 'active', reserved_at: '2026-08-01T00:00:00.000Z', released_at: null },
        { id: 'r2', batch_id: 'batch-2', reserved_amount: '1000000.00', status: 'consumed', reserved_at: '2026-07-01T00:00:00.000Z', released_at: '2026-07-02T00:00:00.000Z' },
      ],
      selcom_balance_checks: [],
      ...overrides,
    };

    return {
      from: (table: string) => {
        const value = tables[table];
        const isArray = Array.isArray(value);
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: () => Promise.resolve({ data: isArray ? null : value, error: null }),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: isArray ? value : null, error: null }).then(resolve),
        };
        return chain;
      },
    } as unknown as Parameters<typeof getDisbursementBalanceDashboard>[0];
  }

  it('sums pending approved payouts and active reservations correctly', async () => {
    const dashboard = await getDisbursementBalanceDashboard(makeFromClient());
    expect(dashboard.pendingApprovedPayoutsTotal).toBeCloseTo(1500000.5);
    expect(dashboard.reservedTotal).toBe(3000000); // only the 'active' reservation, not 'consumed'
  });

  it('computes projected balance as available minus reserved (never fabricated elsewhere)', async () => {
    const dashboard = await getDisbursementBalanceDashboard(makeFromClient());
    expect(dashboard.projectedBalance).toBe(10000000 - 3000000);
  });

  it('flags insufficientBalance when the projected balance would be negative', async () => {
    const dashboard = await getDisbursementBalanceDashboard(
      makeFromClient({
        selcom_balance_reservations: [
          { id: 'r1', batch_id: 'batch-1', reserved_amount: '99000000.00', status: 'active', reserved_at: '2026-08-01T00:00:00.000Z', released_at: null },
        ],
      })
    );
    expect(dashboard.insufficientBalance).toBe(true);
    expect(dashboard.lowBalance).toBe(false);
  });

  it('flags lowBalance when projected balance is positive but under the configured threshold', async () => {
    const dashboard = await getDisbursementBalanceDashboard(
      makeFromClient({
        selcom_balance_reservations: [
          { id: 'r1', batch_id: 'batch-1', reserved_amount: '9000000.00', status: 'active', reserved_at: '2026-08-01T00:00:00.000Z', released_at: null },
        ],
      })
    );
    // available 10,000,000 - reserved 9,000,000 = 1,000,000 projected, under the 2,000,000 threshold
    expect(dashboard.projectedBalance).toBe(1000000);
    expect(dashboard.lowBalance).toBe(true);
    expect(dashboard.insufficientBalance).toBe(false);
  });

  it('never flags low/insufficient balance when no snapshot has ever been recorded', async () => {
    const dashboard = await getDisbursementBalanceDashboard(makeFromClient({ selcom_balance_snapshot: null }));
    expect(dashboard.projectedBalance).toBeNull();
    expect(dashboard.lowBalance).toBe(false);
    expect(dashboard.insufficientBalance).toBe(false);
  });
});
