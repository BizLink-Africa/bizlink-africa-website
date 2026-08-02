// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from './navigation';

// Risk & Compliance has no dedicated route folder of its own — every item
// reuses an existing page from another module (Financial Reports,
// Chargebacks & Holds, Compliance & Security), each already gated by its
// own requirePermission() call. This mirrors the sibling per-module tests
// (e.g. merchant-operations-permissions.test.ts) but points at those other
// modules' actual page files rather than a folder next to this test.
describe('Risk & Compliance — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Risk & Compliance');
  if (!group) throw new Error('Risk & Compliance group not found in navigation.ts');

  const ADMIN_PROTECTED_ROOT = join(__dirname, '..', 'app', 'admin', '(protected)');

  const itemToPageFile: Record<string, string> = {
    'Beneficiary Changes': 'financial-reports/beneficiary-changes/page.tsx',
    'Compliance Holds': 'chargebacks/holds/page.tsx',
    'Audit Reviews': 'compliance/access-reviews/page.tsx',
  };

  it('has exactly the 3 items with an existing backing page today (the other 4 requested — KYC Exceptions, Suspicious Activity Reviews, Merchant Risk Ratings, Transaction Monitoring — have no page yet and are deliberately omitted)', () => {
    expect(group.items.map((i) => i.label).sort()).toEqual(Object.keys(itemToPageFile).sort());
  });

  for (const item of group.items) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const relativePath = itemToPageFile[item.label];
      const source = readFileSync(join(ADMIN_PROTECTED_ROOT, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
    });
  }

  it('Compliance Holds and Settlement & Payouts\' Settlement Holds point at the same route (one page, two labelled entry points)', () => {
    const settlementGroup = NAV_GROUPS.find((g) => g.label === 'Settlement & Payouts');
    const settlementHolds = settlementGroup?.items.find((i) => i.label === 'Settlement Holds');
    const complianceHolds = group.items.find((i) => i.label === 'Compliance Holds');
    expect(settlementHolds?.href).toBe(complianceHolds?.href);
  });

  it('compliance_security holds every permission this group needs (holds.view, access_reviews.view) — "Compliance roles can access KYC, risk and holds"', () => {
    const holdsMigration = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20260813000000_create_chargebacks_holds_reversals.sql'),
      'utf8'
    );
    const accessReviewsMigration = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20260731040000_add_compliance_security_permissions.sql'),
      'utf8'
    );
    expect(holdsMigration).toContain(`('compliance_security', 'holds.view')`);
    expect(accessReviewsMigration).toContain(`('compliance_security', 'access_reviews.view')`);
  });
});
