// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { fromMock, rpcMock, checkPayoutStatusMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  checkPayoutStatusMock: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

vi.mock('@/lib/payouts/status-check-service', () => ({
  checkPayoutStatus: checkPayoutStatusMock,
}));

const { GET } = await import('./route');

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    in: () => builder,
    lte: () => builder,
    limit: () => Promise.resolve(result),
  };
  return builder;
}

function cronRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new Request('https://bizlinkafrica.net/api/payouts/status-check-cron', { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-cron-secret';
});

describe('GET /api/payouts/status-check-cron — auth', () => {
  it('rejects a request with no Authorization header before touching Supabase', async () => {
    const response = await GET(cronRequest());
    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong bearer token', async () => {
    const response = await GET(cronRequest('Bearer wrong-secret'));
    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects every request if CRON_SECRET is not configured, even with a matching-looking header', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(cronRequest('Bearer undefined'));
    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('proceeds past the auth check with the correct bearer token', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: [], error: null }));
    const response = await GET(cronRequest('Bearer test-cron-secret'));
    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith('merchant_payouts');
  });
});

describe('GET /api/payouts/status-check-cron — candidate handling', () => {
  it('checks eligible candidates via the central status-check service, never a separate code path', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({
        data: [{ id: 'p1', payout_reference: 'TRX-1', status: 'processing', status_check_count: 1, status_check_expires_at: null }],
        error: null,
      })
    );
    checkPayoutStatusMock.mockResolvedValue({ querySucceeded: true, applied: true });

    const response = await GET(cronRequest('Bearer test-cron-secret'));
    const json = await response.json();

    expect(checkPayoutStatusMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'p1' }),
      { triggerType: 'scheduled', performedBy: 'system' }
    );
    expect(json.checked).toBe(1);
    expect(json.expired).toBe(0);
  });

  it('moves an expired payout to Manual Review via expire_payout_status_check instead of checking status again', async () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    fromMock.mockReturnValue(
      makeQueryBuilder({
        data: [{ id: 'p2', payout_reference: 'TRX-2', status: 'unknown', status_check_count: 10, status_check_expires_at: expiredAt }],
        error: null,
      })
    );
    rpcMock.mockResolvedValue({ data: null, error: null });

    const response = await GET(cronRequest('Bearer test-cron-secret'));
    const json = await response.json();

    expect(rpcMock).toHaveBeenCalledWith('expire_payout_status_check', { p_payout_id: 'p2', p_performed_by: 'system' });
    expect(checkPayoutStatusMock).not.toHaveBeenCalled();
    expect(json.expired).toBe(1);
    expect(json.checked).toBe(0);
  });

  it('never creates a new disbursement — only ever calls checkPayoutStatus or expire_payout_status_check', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({
        data: [{ id: 'p3', payout_reference: 'TRX-3', status: 'submitted', status_check_count: 0, status_check_expires_at: null }],
        error: null,
      })
    );
    checkPayoutStatusMock.mockResolvedValue({ querySucceeded: true, applied: false });

    await GET(cronRequest('Bearer test-cron-secret'));

    expect(rpcMock).not.toHaveBeenCalledWith('apply_merchant_payout_result', expect.anything());
    expect(rpcMock).not.toHaveBeenCalledWith('submit_payout', expect.anything());
  });

  it('counts an unexpected error from checkPayoutStatus without aborting the batch', async () => {
    fromMock.mockReturnValue(
      makeQueryBuilder({
        data: [
          { id: 'p4', payout_reference: 'TRX-4', status: 'processing', status_check_count: 0, status_check_expires_at: null },
          { id: 'p5', payout_reference: 'TRX-5', status: 'processing', status_check_count: 0, status_check_expires_at: null },
        ],
        error: null,
      })
    );
    checkPayoutStatusMock.mockRejectedValueOnce(new Error('unexpected')).mockResolvedValueOnce({ querySucceeded: true });

    const response = await GET(cronRequest('Bearer test-cron-secret'));
    const json = await response.json();

    expect(json.errored).toBe(1);
    expect(json.checked).toBe(1);
  });

  it('returns 500 without processing anything if fetching candidates itself fails', async () => {
    fromMock.mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'db down' } }));
    const response = await GET(cronRequest('Bearer test-cron-secret'));
    expect(response.status).toBe(500);
    expect(checkPayoutStatusMock).not.toHaveBeenCalled();
  });
});
