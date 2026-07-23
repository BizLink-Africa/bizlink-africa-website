import { describe, expect, it, vi } from 'vitest';

const { headersGet } = vi.hoisted(() => ({ headersGet: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: headersGet }),
}));

const { default: robots } = await import('./robots');

describe('robots — host-aware output', () => {
  it('fully disallows the admin host, with no sitemap reference', async () => {
    headersGet.mockReturnValue('admin.bizlinkafrica.net');
    const result = await robots();
    expect(result.rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(result.sitemap).toBeUndefined();
  });

  it('allows the public host except /admin, and includes the sitemap', async () => {
    headersGet.mockReturnValue('bizlinkafrica.net');
    const result = await robots();
    expect(result.rules).toEqual({ userAgent: '*', allow: '/', disallow: '/admin' });
    expect(result.sitemap).toBe('https://bizlinkafrica.net/sitemap.xml');
  });

  it('treats an unrecognized/missing host as public (fail open to the more permissive, still-/admin-blocked rules)', async () => {
    headersGet.mockReturnValue(null);
    const result = await robots();
    expect(result.rules).toEqual({ userAgent: '*', allow: '/', disallow: '/admin' });
  });
});
