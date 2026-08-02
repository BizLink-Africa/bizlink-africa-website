// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as the sibling per-module tests (e.g. Merchant Operations'
// merchant-operations-permissions.test.ts): the sidebar (navigation.ts)
// declares which permission gates each Commission & Fee Rules route, and
// each page.tsx independently calls requirePermission() to actually
// enforce it. Fails loudly if a route is ever added to the sidebar without
// a matching requirePermission() call in its page.tsx.
describe('Commission & Fee Rules — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Commission & Fee Rules');
  if (!group) throw new Error('Commission & Fee Rules group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/commission-rules': 'page.tsx',
    '/admin/commission-rules/pending': 'pending/page.tsx',
    '/admin/commission-rules/history': 'history/page.tsx',
    '/admin/commission-rules/preview': 'preview/page.tsx',
  };

  // "New Rule" and "Scheduled Rules" are no longer sidebar entries (see
  // navigation.ts) but the routes/pages still exist and must keep
  // independently enforcing their permission.
  const droppedFromNavButStillEnforced: Record<string, string> = {
    'new/page.tsx': 'commission_rules.manage',
    'scheduled/page.tsx': 'commission_rules.view',
  };
  for (const [relativePath, permission] of Object.entries(droppedFromNavButStillEnforced)) {
    it(`${relativePath} (not in sidebar, but route still exists) requires '${permission}'`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${permission}')`);
    });
  }

  it('covers every Commission & Fee Rules nav item (no route was added to the sidebar without an entry here)', () => {
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
    });
  }

  it('the rule detail page requires commission_rules.view', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('commission_rules.view')`);
  });

  it('is only ever granted to super_admin and cfo in the migration (Super Admin / authorised Finance only)', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260810000000_create_commission_fee_rules.sql'),
      'utf8'
    );
    for (const role of ['operations', 'compliance_security', 'ceo', 'customer_support', 'auditor', 'cto', 'marketing']) {
      expect(migration).not.toContain(`('${role}', 'commission_rules`);
    }
    expect(migration).toContain(`('cfo', 'commission_rules.view')`);
  });
});
