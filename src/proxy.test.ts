// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getUser, maybeSingle, eq, select, from } = vi.hoisted(() => {
  return {
    getUser: vi.fn(),
    maybeSingle: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    from: vi.fn(),
  };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
    from,
  })),
}));

const { proxy } = await import('./proxy');

function setupSupabaseChain() {
  eq.mockReturnValue({ maybeSingle });
  select.mockReturnValue({ eq });
  from.mockReturnValue({ select });
}

function makeRequest(url: string, host: string, cookieNames: string[] = []): NextRequest {
  const request = new NextRequest(url, { headers: { host } });
  for (const name of cookieNames) {
    request.cookies.set(name, 'value');
  }
  return request;
}

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  setupSupabaseChain();
  getUser.mockResolvedValue({ data: { user: null } });
});

afterEach(() => {
  process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
});

describe('proxy — production host enforcement', () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = 'production';
  });

  it('rejects an unrecognized production host with a non-disclosing 404', async () => {
    const response = await proxy(makeRequest('https://evil-example.test/', 'evil-example.test'));
    expect(response.status).toBe(404);
  });

  it('rejects /admin/* on the public apex host with a non-disclosing 404', async () => {
    const response = await proxy(makeRequest('https://bizlinkafrica.net/admin/login', 'bizlinkafrica.net'));
    expect(response.status).toBe(404);
  });

  it('rejects /admin/* on the public www host with a non-disclosing 404', async () => {
    const response = await proxy(
      makeRequest('https://www.bizlinkafrica.net/admin/ceo', 'www.bizlinkafrica.net')
    );
    expect(response.status).toBe(404);
  });

  it('does not touch Supabase at all for an ordinary public-host page', async () => {
    const response = await proxy(makeRequest('https://bizlinkafrica.net/contact', 'bizlinkafrica.net'));
    expect(response.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated request to the admin host root into /admin/login', async () => {
    const response = await proxy(makeRequest('https://admin.bizlinkafrica.net/', 'admin.bizlinkafrica.net'));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/admin/login');
    // Redirect stays on the same host — never leaks to the public domain.
    expect(location).toContain('admin.bizlinkafrica.net');
  });

  it('redirects an already-authenticated visit to /admin/login on the admin host to that role\'s dashboard', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    maybeSingle.mockResolvedValue({ data: { role: 'cfo' } });

    const response = await proxy(
      makeRequest('https://admin.bizlinkafrica.net/admin/login', 'admin.bizlinkafrica.net')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/admin/finance');
  });

  it('lets the accept-invite route through with no session (invite links carry the session in a URL fragment, invisible server-side)', async () => {
    const response = await proxy(
      makeRequest('https://admin.bizlinkafrica.net/admin/accept-invite', 'admin.bizlinkafrica.net')
    );
    expect(response.status).toBe(200);
  });

  it('sets X-Robots-Tag noindex on admin responses', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await proxy(
      makeRequest('https://admin.bizlinkafrica.net/admin/ceo', 'admin.bizlinkafrica.net', ['sb-test-auth-token'])
    );
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
  });
});

describe('proxy — /merchant/* gate (independent auth pool from staff)', () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = 'production';
  });

  it('redirects an unauthenticated request to /merchant/onboarding/terms into /merchant/login', async () => {
    const response = await proxy(
      makeRequest('https://bizlinkafrica.net/merchant/onboarding/terms', 'bizlinkafrica.net')
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/merchant/login');
  });

  it('lets an unauthenticated request through to /merchant/login itself', async () => {
    const response = await proxy(makeRequest('https://bizlinkafrica.net/merchant/login', 'bizlinkafrica.net'));
    expect(response.status).toBe(200);
  });

  it('redirects an already-authenticated visit to /merchant/login straight to the terms page', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'merchant-user-1' } } });
    const response = await proxy(makeRequest('https://bizlinkafrica.net/merchant/login', 'bizlinkafrica.net'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/merchant/onboarding/terms');
    // Merchant redirects never touch staff_profiles — a merchant session has no such row.
    expect(from).not.toHaveBeenCalled();
  });

  it('lets an authenticated request through to a protected /merchant/* page', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'merchant-user-1' } } });
    const response = await proxy(
      makeRequest('https://bizlinkafrica.net/merchant/onboarding/terms', 'bizlinkafrica.net')
    );
    expect(response.status).toBe(200);
  });

  it('sets X-Robots-Tag noindex on merchant responses', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'merchant-user-1' } } });
    const response = await proxy(
      makeRequest('https://bizlinkafrica.net/merchant/onboarding/terms', 'bizlinkafrica.net')
    );
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
  });

  it('/merchant/* is reachable on the public host even under the production host allow-list', async () => {
    const response = await proxy(makeRequest('https://www.bizlinkafrica.net/merchant/login', 'www.bizlinkafrica.net'));
    expect(response.status).toBe(200);
  });
});

describe('proxy — non-production (dev/preview) is unrestricted by the host allow-list', () => {
  it('does not reject an unrecognized host when VERCEL_ENV is not "production"', async () => {
    delete process.env.VERCEL_ENV;
    const response = await proxy(makeRequest('http://localhost:3000/contact', 'localhost:3000'));
    expect(response.status).toBe(200);
  });

  it('still runs the auth gate for /admin/* on localhost in dev', async () => {
    delete process.env.VERCEL_ENV;
    const response = await proxy(makeRequest('http://localhost:3000/admin/ceo', 'localhost:3000'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/admin/login');
  });
});
