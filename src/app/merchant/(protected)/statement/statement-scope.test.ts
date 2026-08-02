// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// "Clients may access only their own statements" — the merchant-portal
// statement page and its export route must always derive merchant_id from
// requireActiveMerchant()'s own session-verified profile, never from a
// query string or form field a client could tamper with. This is a
// source-level guard against ever regressing that into
// searchParams.get('merchant') the way the admin-side equivalent does.
describe('Merchant statement — self-service scope is structural, not just RLS', () => {
  it('the page never reads a merchant id from searchParams', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain('requireActiveMerchant()');
    expect(source).toContain('merchant.merchantId');
    expect(source).not.toMatch(/searchParams\.(get\(['"]merchant['"]\)|merchant)/);
  });

  it('the export route never reads a merchant id from searchParams', () => {
    const source = readFileSync(join(__dirname, 'export', 'route.ts'), 'utf8');
    expect(source).toContain('requireActiveMerchant()');
    expect(source).toContain('merchant.merchantId');
    expect(source).not.toMatch(/searchParams\.get\(['"]merchant['"]\)/);
  });

  it('the export route logs every export via the service-role client (audit_logs is staff-only otherwise)', () => {
    const source = readFileSync(join(__dirname, 'export', 'route.ts'), 'utf8');
    expect(source).toContain('createServiceClient');
    expect(source).toContain('logAuditEvent');
  });
});
