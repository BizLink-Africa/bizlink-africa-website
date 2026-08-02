// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { fromMock, rpcMock, insertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  insertMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

const logAuditEventMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/lib/audit', () => ({ logAuditEvent: logAuditEventMock }));

const { POST } = await import('./route');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SELCOM_CALLBACK_SECRET = 'test-secret';
  fromMock.mockReturnValue({ insert: insertMock });
  insertMock.mockResolvedValue({ error: null });
});

function callbackRequest(options: { secretInPath?: string; body?: unknown; rawBody?: string; forwardedProto?: string; forwardedFor?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.forwardedProto) headers['x-forwarded-proto'] = options.forwardedProto;
  if (options.forwardedFor) headers['x-forwarded-for'] = options.forwardedFor;
  return new Request('https://admin.example.com/api/integrations/selcom/callback/whatever', {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(options.body ?? { reference_id: 'TRX-1', status: 'SUCCESS' }),
  });
}

function ctx(secret: string) {
  return { params: Promise.resolve({ secret }) };
}

describe('POST /api/integrations/selcom/callback/[secret] — secret path protection', () => {
  it('rejects a wrong secret with 404, never touching the database', async () => {
    const response = await POST(callbackRequest(), ctx('wrong-secret'));
    expect(response.status).toBe(404);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects when SELCOM_CALLBACK_SECRET is not configured at all, even with a matching-looking path', async () => {
    delete process.env.SELCOM_CALLBACK_SECRET;
    const response = await POST(callbackRequest(), ctx('undefined'));
    expect(response.status).toBe(404);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('proceeds past the secret check with the correct secret', async () => {
    rpcMock.mockResolvedValue({ data: [{ outcome: 'processed', payout_id: 'p1', rejection_reason: null }], error: null });
    const response = await POST(callbackRequest(), ctx('test-secret'));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalled();
  });
});

describe('POST /api/integrations/selcom/callback/[secret] — HTTPS only', () => {
  it('rejects a request explicitly forwarded as http', async () => {
    const response = await POST(callbackRequest({ forwardedProto: 'http' }), ctx('test-secret'));
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('allows a request explicitly forwarded as https', async () => {
    rpcMock.mockResolvedValue({ data: [{ outcome: 'processed', payout_id: 'p1', rejection_reason: null }], error: null });
    const response = await POST(callbackRequest({ forwardedProto: 'https' }), ctx('test-secret'));
    expect(response.status).toBe(200);
  });

  it('allows a request with no forwarded-proto header (local dev, no reverse proxy)', async () => {
    rpcMock.mockResolvedValue({ data: [{ outcome: 'processed', payout_id: 'p1', rejection_reason: null }], error: null });
    const response = await POST(callbackRequest(), ctx('test-secret'));
    expect(response.status).toBe(200);
  });
});

describe('POST /api/integrations/selcom/callback/[secret] — strict request schema', () => {
  it('rejects non-JSON bodies', async () => {
    const response = await POST(callbackRequest({ rawBody: 'not json' }), ctx('test-secret'));
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects a body missing reference_id', async () => {
    const response = await POST(callbackRequest({ body: { status: 'SUCCESS' } }), ctx('test-secret'));
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects a body missing status', async () => {
    const response = await POST(callbackRequest({ body: { reference_id: 'TRX-1' } }), ctx('test-secret'));
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/integrations/selcom/callback/[secret] — happy path', () => {
  it('masks account numbers before calling the RPC and before auditing, never passing the raw value', async () => {
    rpcMock.mockResolvedValue({ data: [{ outcome: 'processed', payout_id: 'p1', rejection_reason: null }], error: null });

    const response = await POST(
      callbackRequest({
        body: {
          reference_id: 'TRX-1',
          status: 'SUCCESS',
          amount: 5000,
          selcom_receipt: 'SBS-1',
          recipient_account_number: '9876543210',
          recipient_name: 'John Doe',
        },
      }),
      ctx('test-secret')
    );

    expect(response.status).toBe(200);
    const rpcArgs = rpcMock.mock.calls[0][1];
    expect(rpcArgs.p_masked_recipient_account_number).toBe('****3210');
    expect(rpcArgs.p_masked_recipient_account_number).not.toContain('987654');
    expect(rpcArgs.p_amount).toBe('5000');

    const auditCall = logAuditEventMock.mock.calls.find((c) => c[0].actionType === 'callback_received');
    expect(JSON.stringify(auditCall?.[0])).not.toContain('9876543210');
  });

  it('returns 200 even for a mismatch outcome — never retry-storms Selcom for something already recorded', async () => {
    rpcMock.mockResolvedValue({ data: [{ outcome: 'amount_mismatch', payout_id: 'p1', rejection_reason: 'mismatch' }], error: null });
    const response = await POST(callbackRequest({ body: { reference_id: 'TRX-1', status: 'SUCCESS', amount: 999 } }), ctx('test-secret'));
    expect(response.status).toBe(200);
  });

  it('writes an alert via admin_notifications for an anomalous outcome', async () => {
    rpcMock.mockResolvedValue({ data: [{ outcome: 'reference_not_found', payout_id: null, rejection_reason: 'No payout found' }], error: null });
    await POST(callbackRequest({ body: { reference_id: 'TRX-UNKNOWN', status: 'SUCCESS' } }), ctx('test-secret'));
    expect(fromMock).toHaveBeenCalledWith('admin_notifications');
  });

  it('does not write an admin_notifications alert for a processed outcome', async () => {
    rpcMock.mockResolvedValue({ data: [{ outcome: 'processed', payout_id: 'p1', rejection_reason: null }], error: null });
    await POST(callbackRequest(), ctx('test-secret'));
    expect(fromMock).not.toHaveBeenCalledWith('admin_notifications');
  });
});

describe('POST /api/integrations/selcom/callback/[secret] — RPC failure handling', () => {
  it('returns 500 and audits the failure when the RPC itself errors, without crashing', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'db unavailable' } });
    const response = await POST(callbackRequest(), ctx('test-secret'));
    expect(response.status).toBe(500);
    expect(logAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ result: 'failure', reason: 'db unavailable' }));
  });
});
