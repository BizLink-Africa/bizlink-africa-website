// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as executive-permissions.test.ts (Executive Management):
// the sidebar (navigation.ts) declares which permission gates each
// Technology route, and each page.tsx independently calls requirePermission()
// to actually enforce it. This is the concrete "CTO restrictions" check —
// it fails loudly if a Technology page is ever added to the sidebar without
// a matching requirePermission() call in its page.tsx, which would let a
// role see a link that then either 403s them unexpectedly or (far worse)
// silently renders data they were never granted access to.
describe('Technology — sidebar permission matches page enforcement', () => {
  const technologyGroup = NAV_GROUPS.find((g) => g.label === 'Technology');
  if (!technologyGroup) throw new Error('Technology group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/cto': 'page.tsx',
    '/admin/integration-health': '../integration-health/page.tsx',
    '/admin/ai-agents': '../ai-agents/page.tsx',
    '/admin/api-monitoring': '../api-monitoring/page.tsx',
    '/admin/webhook-monitoring': '../webhook-monitoring/page.tsx',
    '/admin/deployments': '../deployments/page.tsx',
    '/admin/background-jobs': '../background-jobs/page.tsx',
    '/admin/technical-incidents': '../technical-incidents/page.tsx',
    '/admin/system-health': '../system-health/page.tsx',
    '/admin/database-health': '../database-health/page.tsx',
    '/admin/backup-monitoring': '../backup-monitoring/page.tsx',
    '/admin/technology/reports': '../technology/reports/page.tsx',
    '/admin/technology/settings': '../technology/settings/page.tsx',
  };

  it('covers every Technology nav item (no route was added to the sidebar without an entry here)', () => {
    for (const item of technologyGroup.items) {
      expect(routeToPageFile[item.href], `no known page file mapped for ${item.href}`).toBeDefined();
    }
    expect(Object.keys(routeToPageFile)).toHaveLength(technologyGroup.items.length);
  });

  for (const item of technologyGroup.items) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const relativePath = routeToPageFile[item.href];
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
    });
  }
});
