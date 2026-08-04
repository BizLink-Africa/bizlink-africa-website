// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// The entire Chargebacks & Holds module (cases, evidence, resolution,
// recovery, settlement holds, and manual reversals) is now an archived
// financial prototype, Super Admin only. Opening a new chargeback case
// fundamentally depends on collection_transactions — BizLink's own record
// of merchant collections — which is itself archived, since BizLink Africa
// does not receive, hold, reconcile, disburse or settle merchant funds.
// Manual reversals write directly against that same archived collection
// ledger. The "Chargebacks & Holds" nav group was removed entirely (not
// just the holds items within it) — see navigation.ts and
// src/lib/archived-financial-prototype.ts. Nothing was deleted: every
// page.tsx still independently enforces its original requirePermission()
// call, and the underlying DB grants were never revoked. See
// src/app/admin/(protected)/settlement/settlement-permissions.test.ts for
// the sibling module this pattern was first applied to.
describe('Chargebacks & Holds — dissolved group, whole module archived and Super-Admin gated', () => {
  it('is no longer present in NAV_GROUPS (stays caught if someone re-adds it without going through the archival process)', () => {
    const group = NAV_GROUPS.find((g) => g.label === 'Chargebacks & Holds');
    expect(group).toBeUndefined();
  });

  // Every route/page in the module still exists and must keep
  // independently enforcing its original permission, even though none of
  // them are linked from the sidebar any more.
  const routeToPageFilePermission: Record<string, [string, string]> = {
    '/admin/chargebacks': ['page.tsx', 'chargebacks.view'],
    '/admin/chargebacks/new': ['new/page.tsx', 'chargebacks.manage'],
    '/admin/chargebacks/reporting': ['reporting/page.tsx', 'chargebacks.view'],
    '/admin/chargebacks/exposure': ['exposure/page.tsx', 'chargebacks.view'],
    '/admin/chargebacks/reversals': ['reversals/page.tsx', 'reversals.view'],
    '/admin/chargebacks/holds': ['holds/page.tsx', 'holds.view'],
    '/admin/chargebacks/holds/new': ['holds/new/page.tsx', 'holds.manage'],
  };

  for (const [route, [relativePath, permission]] of Object.entries(routeToPageFilePermission)) {
    it(`${route}'s page.tsx (${relativePath}) still requires '${permission}', even though it is no longer linked from the sidebar`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${permission}')`);
    });
  }

  it('the case detail page still requires chargebacks.view, chargebacks.manage and chargebacks.resolve for their respective actions', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('chargebacks.view')`);
    expect(source).toContain(`requirePermission('chargebacks.manage')`);
    expect(source).toContain(`requirePermission('chargebacks.resolve')`);
  });

  it('the hold detail page still requires holds.view, holds.manage and holds.approve for their respective actions', () => {
    const source = readFileSync(join(__dirname, 'holds/[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('holds.view')`);
    expect(source).toContain(`requirePermission('holds.manage')`);
    expect(source).toContain(`requirePermission('holds.approve')`);
  });

  it('the reversals list still requires reversals.view and reversals.approve for their respective actions', () => {
    const source = readFileSync(join(__dirname, 'reversals/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('reversals.view')`);
    expect(source).toContain(`requirePermission('reversals.approve')`);
  });

  it('never gates a page behind roles.manage or users.manage', () => {
    const allFiles = [
      ...Object.values(routeToPageFilePermission).map(([relativePath]) => relativePath),
      '[id]/page.tsx',
      'holds/[id]/page.tsx',
    ];
    for (const relativePath of allFiles) {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).not.toContain(`requirePermission('roles.manage')`);
      expect(source).not.toContain(`requirePermission('users.manage')`);
    }
  });

  it('is only ever granted to super_admin, compliance_security and cfo/ceo (view) in the migration', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260813000000_create_chargebacks_holds_reversals.sql'),
      'utf8'
    );
    for (const role of ['operations', 'customer_support', 'auditor', 'cto', 'marketing']) {
      expect(migration).not.toContain(`('${role}', 'chargebacks.`);
      expect(migration).not.toContain(`('${role}', 'holds.`);
      expect(migration).not.toContain(`('${role}', 'reversals.`);
    }
  });

  it('never allows a mutation through frontend state alone — every mutating RPC is revoked from anon', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260813000000_create_chargebacks_holds_reversals.sql'),
      'utf8'
    );
    for (const fn of [
      'open_chargeback_case', 'request_chargeback_evidence', 'submit_chargeback_evidence', 'begin_chargeback_review',
      'resolve_chargeback_case', 'close_chargeback_case', 'record_chargeback_recovery',
      'place_settlement_hold', 'request_settlement_hold_release', 'approve_settlement_hold_release', 'reject_settlement_hold_release',
      'request_manual_reversal', 'approve_manual_reversal', 'reject_manual_reversal',
    ]) {
      expect(migration).toContain(`revoke execute on function ${fn}`);
    }
  });

  it('"held amounts cannot be settled" — prepare_settlement_batch checks settlement_holds', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260813000000_create_chargebacks_holds_reversals.sql'),
      'utf8'
    );
    expect(migration).toContain('no_active_settlement_hold');
    expect(migration).toMatch(/from settlement_holds[\s\S]*status = 'active'/);
  });

  // The whole chargebacks/** tree (holds included, one level up) is gated
  // by a single archived-prototype layout — the narrower
  // chargebacks/holds/layout.tsx that previously covered only settlement
  // holds was deleted in favour of this one.
  it("chargebacks/layout.tsx wires up the archived-prototype access gate for the whole module", () => {
    const source = readFileSync(join(__dirname, 'layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
  });
});
