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
    '/admin/integration-health/transactions': '../integration-health/transactions/page.tsx',
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

  // "Settlement Beneficiaries" was removed from this group — merchant
  // settlement beneficiary management is now an archived financial
  // prototype (Super Admin only): the module exists to prepare/verify a
  // payout destination for BizLink-initiated disbursement, and the
  // confirmed operating model has each merchant supply and maintain their
  // own settlement instructions directly with the approved payment
  // partner. The route/page still exist and still independently enforce
  // their original permission — see
  // beneficiaries/lookup-permissions.test.ts for the full archival
  // coverage (nav-item removal, layout gate, actions.ts guard).
  it('beneficiaries/page.tsx (not in sidebar, but route still exists) requires merchant_beneficiaries.view', () => {
    const source = readFileSync(join(__dirname, 'beneficiaries/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('merchant_beneficiaries.view')`);
  });

  it("beneficiaries/layout.tsx wires up the archived-prototype access gate", () => {
    const source = readFileSync(join(__dirname, 'beneficiaries/layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
  });
});
