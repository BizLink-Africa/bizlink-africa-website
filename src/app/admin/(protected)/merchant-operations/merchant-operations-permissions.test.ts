// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as the sibling per-module tests (e.g. Technology's
// technology-permissions.test.ts): the sidebar (navigation.ts) declares
// which permission gates each Merchant Operations route, and each
// page.tsx independently calls requirePermission() to actually enforce
// it. Fails loudly if a route is ever added to the sidebar without a
// matching requirePermission() call in its page.tsx.
describe('Merchant Operations — sidebar permission matches page enforcement', () => {
  const merchantOpsGroup = NAV_GROUPS.find((g) => g.label === 'Merchant Operations');
  if (!merchantOpsGroup) throw new Error('Merchant Operations group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/merchant-operations/applications': 'applications/page.tsx',
    '/admin/merchant-operations/profiles': 'profiles/page.tsx',
    '/admin/merchant-operations/kyc': 'kyc/page.tsx',
    '/admin/merchant-operations/tills': 'tills/page.tsx',
    '/admin/merchant-operations/beneficiaries': 'beneficiaries/page.tsx',
  };

  it('covers every Merchant Operations nav item (no route was added to the sidebar without an entry here)', () => {
    for (const item of merchantOpsGroup.items) {
      expect(routeToPageFile[item.href], `no known page file mapped for ${item.href}`).toBeDefined();
    }
    expect(Object.keys(routeToPageFile)).toHaveLength(merchantOpsGroup.items.length);
  });

  for (const item of merchantOpsGroup.items) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const relativePath = routeToPageFile[item.href];
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
    });
  }

  it('the merchant profile detail page requires merchants.view', () => {
    const source = readFileSync(join(__dirname, 'profiles/[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('merchants.view')`);
  });

  it('never gates a Merchant Operations route behind roles.manage or users.manage', () => {
    for (const relativePath of Object.values(routeToPageFile)) {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).not.toContain(`requirePermission('roles.manage')`);
      expect(source).not.toContain(`requirePermission('users.manage')`);
    }
  });
});
