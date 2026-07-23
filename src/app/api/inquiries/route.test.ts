// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

vi.mock('@/lib/email/resend', () => ({
  sendInquiryNotificationEmail: vi.fn(async () => ({ success: true })),
}));

const { POST, OPTIONS } = await import('./route');

beforeEach(() => {
  vi.clearAllMocks();
});

function postRequest(origin: string | null, body: unknown = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (origin) headers.origin = origin;
  return new Request('https://bizlinkafrica.net/api/inquiries', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// A generic chainable query-builder stand-in: every chain method returns
// itself, and awaiting the chain at any point (this route sometimes awaits
// mid-chain, sometimes after an explicit .single()/.maybeSingle()) resolves
// to the same result shape. Good enough to drive execution safely past the
// CORS check being tested here — not a faithful Supabase mock, and not
// meant to exercise the rest of the route's business logic.
function makeQueryBuilder(result: Record<string, unknown> = { data: null, error: null, count: 0 }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    insert: () => builder,
    update: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

describe('POST /api/inquiries — CORS/origin allow-list', () => {
  it('rejects a cross-origin request from an unrecognized Origin before touching Supabase', async () => {
    const response = await POST(postRequest('https://attacker.example'));
    expect(response.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('does not reject a request with no Origin header (same-origin browser requests often omit it)', async () => {
    fromMock.mockReturnValue(makeQueryBuilder());
    const response = await POST(postRequest(null));
    // Falls through past the origin check into normal validation (400 for
    // an empty/invalid body here) rather than the 403 origin-rejection path.
    expect(response.status).not.toBe(403);
  });

  it('does not reject an allowed public-site Origin', async () => {
    fromMock.mockReturnValue(makeQueryBuilder());
    const response = await POST(postRequest('https://bizlinkafrica.net'));
    expect(response.status).not.toBe(403);
  });
});

describe('OPTIONS /api/inquiries — CORS preflight', () => {
  it('echoes back an allowed origin', async () => {
    const request = new Request('https://bizlinkafrica.net/api/inquiries', {
      method: 'OPTIONS',
      headers: { origin: 'https://www.bizlinkafrica.net' },
    });
    const response = await OPTIONS(request);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://www.bizlinkafrica.net');
  });

  it('never echoes back an arbitrary/disallowed origin', async () => {
    const request = new Request('https://bizlinkafrica.net/api/inquiries', {
      method: 'OPTIONS',
      headers: { origin: 'https://attacker.example' },
    });
    const response = await OPTIONS(request);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
