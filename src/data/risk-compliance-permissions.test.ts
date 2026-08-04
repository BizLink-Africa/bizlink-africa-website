// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from './navigation';

// Risk & Compliance modeled BizLink as the party holding/settling merchant
// funds (its items pointed at Financial Reports' Beneficiary Changes and the
// Settlement Holds queue). BizLink Africa does not receive, hold,
// reconcile, disburse or settle merchant funds, so the group itself was
// removed from active navigation — see navigation.ts and
// src/lib/archived-financial-prototype.ts. It never had its own route
// folder (every item reused a page from another module), so there is no
// single "Risk & Compliance" layout.tsx — instead each underlying page's
// route root has its own archived-prototype layout, asserted below.
describe('Risk & Compliance — dissolved group, underlying pages archived and Super-Admin gated', () => {
  const ADMIN_PROTECTED_ROOT = join(__dirname, '..', 'app', 'admin', '(protected)');

  it('is no longer present in NAV_GROUPS (stays caught if someone re-adds it without going through the archival process)', () => {
    const group = NAV_GROUPS.find((g) => g.label === 'Risk & Compliance');
    expect(group).toBeUndefined();
  });

  // The underlying pages still exist and still independently enforce their
  // original permission — only the sidebar link was removed. This proves
  // the DB-level grants (e.g. compliance_security holding holds.view) are
  // untouched.
  const itemToPageFile: Record<string, string> = {
    'Beneficiary Changes': 'financial-reports/beneficiary-changes/page.tsx',
    'Compliance Holds': 'chargebacks/holds/page.tsx',
    'Audit Reviews': 'compliance/access-reviews/page.tsx',
  };
  const itemToPermission: Record<string, string> = {
    'Beneficiary Changes': 'financial_reports.view',
    'Compliance Holds': 'holds.view',
    'Audit Reviews': 'access_reviews.view',
  };

  for (const [label, relativePath] of Object.entries(itemToPageFile)) {
    it(`${label}'s page.tsx (${relativePath}) still requires '${itemToPermission[label]}', even though it is no longer linked from Risk & Compliance`, () => {
      const source = readFileSync(join(ADMIN_PROTECTED_ROOT, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${itemToPermission[label]}')`);
    });
  }

  // Beneficiary Changes and Compliance Holds are both part of the archived
  // financial prototype (BizLink no longer models settlement/beneficiary
  // funds flows) and are gated Super Admin only at the layout level. Audit
  // Reviews is a general compliance tool, unrelated to merchant funds, and
  // remains fully active — it has no archived-prototype layout.
  it("financial-reports/layout.tsx (covers Beneficiary Changes) wires up the archived-prototype access gate", () => {
    const source = readFileSync(join(ADMIN_PROTECTED_ROOT, 'financial-reports', 'layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
  });

  // "Compliance Holds" is served by chargebacks/holds/page.tsx. That route
  // used to have its own narrower layout.tsx covering just settlement
  // holds — that was superseded by a single layout.tsx one level up
  // covering the whole chargebacks/** tree, since the entire Chargebacks &
  // Holds module (not just holds) is now an archived financial prototype.
  it("chargebacks/layout.tsx (covers Compliance Holds, one level up) wires up the archived-prototype access gate", () => {
    const source = readFileSync(join(ADMIN_PROTECTED_ROOT, 'chargebacks', 'layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
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
