// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Settlement & Payouts modeled BizLink as the party collecting,
// reconciling, disbursing and settling merchant funds. BizLink Africa does
// not receive, hold, reconcile, disburse or settle merchant funds —
// merchants settle directly with their approved payment partner — so this
// group was removed from active navigation and every route root it
// touched (settlement, payouts, merchant-operations/collections,
// merchant-operations/reconciliation, chargebacks/holds) is now gated
// Super Admin only behind the archived-financial-prototype layout — see
// navigation.ts and src/lib/archived-financial-prototype.ts. Nothing was
// deleted: every page.tsx still independently enforces its original
// requirePermission() call, and the underlying DB grants were never
// revoked.
describe('Settlement & Payouts — dissolved group, routes archived and Super-Admin gated', () => {
  it('is no longer present in NAV_GROUPS (stays caught if someone re-adds it without going through the archival process)', () => {
    const group = NAV_GROUPS.find((g) => g.label === 'Settlement & Payouts');
    expect(group).toBeUndefined();
  });

  const routeToPageFilePermission: Record<string, [string, string]> = {
    '/admin/merchant-operations/collections': ['../merchant-operations/collections/page.tsx', 'collections.view'],
    '/admin/merchant-operations/reconciliation': ['../merchant-operations/reconciliation/page.tsx', 'collections.view'],
    '/admin/settlement': ['page.tsx', 'settlement.view'],
    '/admin/settlement/balance': ['balance/page.tsx', 'disbursement_balance.view'],
    '/admin/payouts': ['../payouts/page.tsx', 'payouts.view'],
    '/admin/chargebacks/holds': ['../chargebacks/holds/page.tsx', 'holds.view'],
  };

  for (const [route, [relativePath, permission]] of Object.entries(routeToPageFilePermission)) {
    it(`${route}'s page.tsx (${relativePath}) still requires '${permission}', even though it is no longer linked from the sidebar`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${permission}')`);
    });
  }

  // "Prepare Batch" was already dropped from the sidebar before this
  // change (reached via a button on the Settlement Batches list page
  // instead) but the route still exists and must keep independently
  // enforcing its permission.
  it('new/page.tsx (not in sidebar, but route still exists) requires settlement.prepare', () => {
    const source = readFileSync(join(__dirname, 'new/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('settlement.prepare')`);
  });

  // Dynamic [id] sub-pages aren't in the sidebar (mirrors the merchant
  // profile detail page precedent) but must still independently enforce
  // the correct stage-specific permission — not just settlement.view.
  const dynamicPages: Record<string, string> = {
    '[id]/page.tsx': 'settlement.view',
    '[id]/merchants/page.tsx': 'settlement.view',
    '[id]/transactions/page.tsx': 'settlement.view',
    '[id]/history/page.tsx': 'settlement.view',
    '[id]/review/page.tsx': 'settlement.review',
    '[id]/approve/page.tsx': 'settlement.approve',
  };
  for (const [relativePath, permission] of Object.entries(dynamicPages)) {
    it(`${relativePath} requires '${permission}'`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${permission}')`);
    });
  }

  it('the rejection screen requires either settlement.review or settlement.approve, never neither', () => {
    const source = readFileSync(join(__dirname, '[id]/reject/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('settlement.review')`);
    expect(source).toContain(`requirePermission('settlement.approve')`);
  });

  it('is only ever granted to super_admin, cfo, ceo (view) and compliance_security (hold) in the migration', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260811000000_create_settlement_batches.sql'),
      'utf8'
    );
    for (const role of ['operations', 'customer_support', 'auditor', 'cto', 'marketing']) {
      expect(migration).not.toContain(`('${role}', 'settlement.`);
    }
  });

  it('the batch detail page still references fresh re-authentication for emergency-eligible batches', () => {
    const source = readFileSync(join(__dirname, '[id]', 'page.tsx'), 'utf8');
    expect(source).toContain('hasRecentReauth(SETTLEMENT_EMERGENCY_REAUTH_PURPOSE)');
    expect(source).toContain('SettlementEmergencyReauthPrompt');
  });

  it('never allows approval through frontend state alone — every mutating RPC is revoked from anon', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260811000000_create_settlement_batches.sql'),
      'utf8'
    );
    for (const fn of [
      'prepare_settlement_batch', 'submit_settlement_batch_for_review', 'review_settlement_batch',
      'reject_settlement_batch', 'approve_settlement_batch', 'place_settlement_batch_hold',
      'release_settlement_batch_hold', 'emergency_cancel_settlement_batch',
      'begin_settlement_batch_processing', 'apply_settlement_line_payout_result',
    ]) {
      expect(migration).toContain(`revoke execute on function ${fn}`);
    }
  });

  // Every route root this dissolved group touched now has its own
  // archived-prototype layout gating access to Super Admin only.
  // "chargebacks/holds" used to have its own narrower layout.tsx covering
  // just settlement holds — that was superseded by a single layout.tsx one
  // level up covering the whole chargebacks/** tree (the whole module is
  // archived now, not just holds — see
  // src/app/admin/(protected)/chargebacks/chargebacks-permissions.test.ts).
  const archivedLayouts: Record<string, string> = {
    'settlement (this module)': 'layout.tsx',
    'payouts': '../payouts/layout.tsx',
    'merchant-operations/collections': '../merchant-operations/collections/layout.tsx',
    'merchant-operations/reconciliation': '../merchant-operations/reconciliation/layout.tsx',
    'chargebacks (covers holds too)': '../chargebacks/layout.tsx',
  };
  for (const [label, relativePath] of Object.entries(archivedLayouts)) {
    it(`${label}'s layout.tsx wires up the archived-prototype access gate`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain('checkArchivedFinancialPrototypeAccess');
    });
  }
});
