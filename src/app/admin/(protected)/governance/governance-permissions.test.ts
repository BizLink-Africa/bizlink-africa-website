// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as executive-permissions.test.ts, cto/technology-permissions.test.ts,
// and compliance/compliance-security-permissions.test.ts: the sidebar declares which
// permission gates each Governance route, and each page.tsx independently calls
// requirePermission() with that exact string. Also asserts no Governance route is
// gated by 'roles.manage' or 'users.manage' — those permissions actually mutate
// roles/staff, and no Governance VIEW page should require them just to render.
describe('Governance — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Governance');
  if (!group) throw new Error('Governance group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/governance': 'page.tsx',
    '/admin/governance/roles': 'roles/page.tsx',
    '/admin/governance/policies': 'policies/page.tsx',
    '/admin/governance/departments': 'departments/page.tsx',
    '/admin/governance/approval-workflows': 'approval-workflows/page.tsx',
    '/admin/compliance/access-reviews': '../compliance/access-reviews/page.tsx',
    '/admin/governance/access-review': 'access-review/page.tsx',
    '/admin/governance/analytics': 'analytics/page.tsx',
    '/admin/governance/audit-summary': 'audit-summary/page.tsx',
    '/admin/governance/reports': 'reports/page.tsx',
    '/admin/compliance': '../compliance/page.tsx',
  };

  it('covers every Governance nav item (no route was added to the sidebar without an entry here)', () => {
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
