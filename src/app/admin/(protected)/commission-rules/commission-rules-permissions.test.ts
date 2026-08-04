// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Commission & Fee Rules modeled BizLink as the party deducting a
// commission/fee from merchant collections. BizLink Africa does not
// receive, hold, reconcile, disburse or settle merchant funds, so this
// group was removed from active navigation and its routes are now gated
// Super Admin only behind the archived-financial-prototype layout — see
// navigation.ts and src/lib/archived-financial-prototype.ts. Nothing was
// deleted: every page.tsx still independently enforces its original
// requirePermission() call, and the underlying DB grants (e.g. cfo holding
// commission_rules.view) were never revoked.
describe('Commission & Fee Rules — dissolved group, routes archived and Super-Admin gated', () => {
  it('is no longer present in NAV_GROUPS (stays caught if someone re-adds it without going through the archival process)', () => {
    const group = NAV_GROUPS.find((g) => g.label === 'Commission & Fee Rules');
    expect(group).toBeUndefined();
  });

  // Every route that used to be in the sidebar (plus the two that were
  // already dropped from nav before this) must still independently enforce
  // its permission — only the sidebar link and the reachability of the
  // module changed.
  const pageFileToPermission: Record<string, string> = {
    'page.tsx': 'commission_rules.view',
    'pending/page.tsx': 'commission_rules.approve',
    'history/page.tsx': 'commission_rules.view',
    'preview/page.tsx': 'commission_rules.view',
    'new/page.tsx': 'commission_rules.manage',
    'scheduled/page.tsx': 'commission_rules.view',
    '[id]/page.tsx': 'commission_rules.view',
  };
  for (const [relativePath, permission] of Object.entries(pageFileToPermission)) {
    it(`${relativePath} still requires '${permission}', even though the module is no longer linked from the sidebar`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${permission}')`);
    });
  }

  it('layout.tsx wires up the archived-prototype access gate (Super Admin only)', () => {
    const source = readFileSync(join(__dirname, 'layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
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
