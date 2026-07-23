import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

function headerValue(headers: { key: string; value: string }[], key: string): string | undefined {
  return headers.find((h) => h.key === key)?.value;
}

describe('next.config.ts — security headers', () => {
  it('applies a baseline security header set to every route', async () => {
    const headerGroups = await nextConfig.headers!();
    expect(headerGroups).toHaveLength(1);
    expect(headerGroups[0].source).toBe('/:path*');

    const headers = headerGroups[0].headers;
    expect(headerValue(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue(headers, 'X-Frame-Options')).toBe('DENY');
    expect(headerValue(headers, 'Strict-Transport-Security')).toContain('max-age=');
    expect(headerValue(headers, 'Referrer-Policy')).toBeTruthy();
    expect(headerValue(headers, 'Permissions-Policy')).toBeTruthy();
    expect(headerValue(headers, 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headerValue(headers, 'Cross-Origin-Resource-Policy')).toBe('same-origin');
  });

  it('CSP includes frame-ancestors none, object-src none, and upgrade-insecure-requests', async () => {
    const headerGroups = await nextConfig.headers!();
    const csp = headerValue(headerGroups[0].headers, 'Content-Security-Policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toContain("default-src 'self'");
  });

  it('disables the X-Powered-By header', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('permanently redirects www to the apex domain via a host match, not a hardcoded path list', async () => {
    const redirects = await nextConfig.redirects!();
    const wwwRedirect = redirects.find((r) =>
      r.has?.some((cond) => 'type' in cond && cond.type === 'host' && 'value' in cond && cond.value === 'www.bizlinkafrica.net')
    );
    expect(wwwRedirect).toBeDefined();
    expect(wwwRedirect?.permanent).toBe(true);
    expect(wwwRedirect?.destination).toBe('https://bizlinkafrica.net/:path*');
  });
});
