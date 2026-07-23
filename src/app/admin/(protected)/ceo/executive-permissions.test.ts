// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// The sidebar (navigation.ts) declares which permission gates each route,
// and each page.tsx independently calls requirePermission() to actually
// enforce it — two hand-written places that must agree, or a role could see
// a link in the sidebar for a page that then rejects them (or worse, a page
// could be reachable by a role the sidebar never intended to show it to,
// since the sidebar hiding a link is NOT itself an access control — only
// requirePermission() is). This walks every Executive Management nav item
// and confirms its page.tsx calls requirePermission with that exact string.
describe('Executive Management — sidebar permission matches page enforcement', () => {
  const executiveGroup = NAV_GROUPS.find((g) => g.label === 'Executive Management');
  if (!executiveGroup) throw new Error('Executive Management group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/ceo': 'page.tsx',
    '/admin/ceo/actions': 'actions/page.tsx',
    '/admin/ceo/approvals': 'approvals/page.tsx',
    '/admin/ceo/performance': 'performance/page.tsx',
    '/admin/ceo/reports': 'reports/page.tsx',
    '/admin/ceo/alerts': 'alerts/page.tsx',
  };

  for (const item of executiveGroup.items) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const relativePath = routeToPageFile[item.href];
      expect(relativePath, `no known page file mapped for ${item.href}`).toBeDefined();

      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
    });
  }
});
