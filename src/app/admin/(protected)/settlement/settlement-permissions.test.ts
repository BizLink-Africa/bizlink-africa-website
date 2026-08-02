// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Same guarantee as the sibling per-module tests (e.g. Merchant Operations'
// merchant-operations-permissions.test.ts and Commission & Fee Rules'
// commission-rules-permissions.test.ts): the sidebar declares which
// permission gates each route, and each page.tsx independently calls
// requirePermission() to actually enforce it.
describe('Settlement & Payouts — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Settlement & Payouts');
  if (!group) throw new Error('Settlement & Payouts group not found in navigation.ts');

  // Collection Ledger / Daily Reconciliation moved in from Merchant
  // Operations; Merchant Payouts moved in from its own former top-level
  // group (removed — see navigation.ts); Payout Approvals / Failed Payouts
  // reuse that same payouts list page via its own ?status= filter rather
  // than being new pages; Settlement Holds reuses the existing hold queue
  // page (also linked from Risk & Compliance as "Compliance Holds").
  const routeToPageFile: Record<string, string> = {
    '/admin/merchant-operations/collections': '../merchant-operations/collections/page.tsx',
    '/admin/merchant-operations/reconciliation': '../merchant-operations/reconciliation/page.tsx',
    '/admin/settlement': 'page.tsx',
    '/admin/settlement/balance': 'balance/page.tsx',
    '/admin/payouts?status=pending_approval': '../payouts/page.tsx',
    '/admin/payouts': '../payouts/page.tsx',
    '/admin/payouts?status=failed': '../payouts/page.tsx',
    '/admin/chargebacks/holds': '../chargebacks/holds/page.tsx',
  };

  it('covers every Settlement & Payouts nav item', () => {
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

  // "Prepare Batch" is no longer a sidebar entry (reached via a button on
  // the Settlement Batches list page instead) but the route still exists
  // and must keep independently enforcing its permission.
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

  it('the batch detail page gates emergency-eligible batches behind fresh re-authentication', () => {
    const source = readFileSync(join(__dirname, '[id]', 'page.tsx'), 'utf8');
    expect(source).toContain('hasRecentReauth(SETTLEMENT_EMERGENCY_REAUTH_PURPOSE)');
    expect(source).toContain('SettlementEmergencyReauthPrompt');
  });

  it('emergencyCancelSettlementBatch checks hasRecentReauth and threads a reason into the audit log', () => {
    const source = readFileSync(join(__dirname, 'actions.ts'), 'utf8');
    const fn = source.slice(
      source.indexOf('export async function emergencyCancelSettlementBatch'),
      source.indexOf('export async function emergencyCancelSettlementBatch') + 1500
    );
    expect(fn).toContain('hasRecentReauth(SETTLEMENT_EMERGENCY_REAUTH_PURPOSE)');
    expect(fn).toContain('reason,');
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
});
