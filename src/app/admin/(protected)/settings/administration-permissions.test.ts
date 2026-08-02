// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as executive-permissions.test.ts, cto/technology-permissions.test.ts,
// compliance/compliance-security-permissions.test.ts, and governance/governance-permissions.test.ts:
// the sidebar declares which permission gates each Administration route, and each page.tsx
// independently calls requirePermission() with that exact string. Profile is the one item with
// permission: null (every signed-in staff member has a profile) — it's asserted to gate on
// verifyAdminSession() instead. Several items intentionally point at pages that already exist
// under another module's own nav group (Finance/Support/Technology Settings) — same
// duplicate-avoidance pattern Governance uses for Policies/Staff Access Reviews.
describe('Administration — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Administration');
  if (!group) throw new Error('Administration group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/staff': '../staff/page.tsx',
    '/admin/audit-logs': '../audit-logs/page.tsx',
    '/admin/notifications': '../notifications/page.tsx',
    '/admin/settings/integrations/selcom': 'integrations/selcom/page.tsx',
    '/admin/settings/integrations/selcom/production-readiness': 'integrations/selcom/production-readiness/page.tsx',
    '/admin/settings/company': 'company/page.tsx',
    '/admin/finance/settings': '../finance/settings/page.tsx',
    '/admin/settings/contracts': 'contracts/page.tsx',
    '/admin/support/settings': '../support/settings/page.tsx',
    '/admin/settings/marketing': 'marketing/page.tsx',
    '/admin/technology/settings': '../technology/settings/page.tsx',
    '/admin/settings/compliance': 'compliance/page.tsx',
    '/admin/settings/security': 'security/page.tsx',
    '/admin/settings/email': 'email/page.tsx',
    '/admin/settings/notification-settings': 'notification-settings/page.tsx',
    '/admin/settings/system': 'system/page.tsx',
    '/admin/settings/profile': 'profile/page.tsx',
  };

  it('covers every Administration nav item (no route was added to the sidebar without an entry here)', () => {
    for (const item of group.items) {
      expect(routeToPageFile[item.href], `no known page file mapped for ${item.href}`).toBeDefined();
    }
    expect(Object.keys(routeToPageFile)).toHaveLength(group.items.length);
  });

  for (const item of group.items) {
    it(`${item.label} (${item.href}) page.tsx enforces '${item.permission ?? 'session only'}'`, () => {
      const relativePath = routeToPageFile[item.href];
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      if (item.permission === null) {
        expect(source).toContain('verifyAdminSession()');
      } else {
        expect(source).toContain(`requirePermission('${item.permission}')`);
      }
      expect(item.permission).not.toBe('roles.manage');
      expect(item.permission).not.toBe('users.manage');
    });
  }
});
