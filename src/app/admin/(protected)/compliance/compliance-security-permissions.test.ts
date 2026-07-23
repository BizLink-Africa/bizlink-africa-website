// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as executive-permissions.test.ts (Executive Management) and
// cto/technology-permissions.test.ts (Technology): the sidebar declares
// which permission gates each Compliance & Security route, and each
// page.tsx independently calls requirePermission() with that exact string.
// Also doubles as the "compliance vs. core roles" structural check: none of
// these routes are gated by 'roles.manage' or 'users.manage' — compliance
// staff reviewing/recording here can never accidentally be routed through
// the same permission that actually changes a role.
describe('Compliance & Security — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Compliance & Security');
  if (!group) throw new Error('Compliance & Security group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/compliance': 'page.tsx',
    '/admin/compliance/reviews': 'reviews/page.tsx',
    '/admin/compliance/clients': 'clients/page.tsx',
    '/admin/compliance/contracts': 'contracts/page.tsx',
    '/admin/compliance/data-protection': 'data-protection/page.tsx',
    '/admin/governance/policies': '../governance/policies/page.tsx',
    '/admin/compliance/policy-acknowledgements': 'policy-acknowledgements/page.tsx',
    '/admin/compliance/access-reviews': 'access-reviews/page.tsx',
    '/admin/security': '../security/page.tsx',
    '/admin/compliance/security-events': 'security-events/page.tsx',
    '/admin/security/incidents': '../security/incidents/page.tsx',
    '/admin/security/sessions': '../security/sessions/page.tsx',
    '/admin/security/logins': '../security/logins/page.tsx',
    '/admin/compliance/reports': 'reports/page.tsx',
    '/admin/security/reports': '../security/reports/page.tsx',
  };

  it('covers every Compliance & Security nav item (no route was added to the sidebar without an entry here)', () => {
    for (const item of group.items) {
      expect(routeToPageFile[item.href], `no known page file mapped for ${item.href}`).toBeDefined();
    }
    expect(Object.keys(routeToPageFile)).toHaveLength(group.items.length);
  });

  for (const item of group.items) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const relativePath = routeToPageFile[item.href];
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
      expect(item.permission).not.toBe('roles.manage');
      expect(item.permission).not.toBe('users.manage');
    });
  }
});
