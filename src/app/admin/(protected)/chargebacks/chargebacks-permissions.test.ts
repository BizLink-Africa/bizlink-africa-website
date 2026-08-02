// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

describe('Chargebacks & Holds — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Chargebacks & Holds');
  if (!group) throw new Error('Chargebacks & Holds group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/chargebacks': 'page.tsx',
    '/admin/chargebacks/reversals': 'reversals/page.tsx',
  };

  it('covers every Chargebacks & Holds nav item', () => {
    for (const item of group.items) {
      expect(routeToPageFile[item.href], `no known page file mapped for ${item.href}`).toBeDefined();
    }
    expect(Object.keys(routeToPageFile)).toHaveLength(group.items.length);
  });

  for (const item of group.items) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const source = readFileSync(join(__dirname, routeToPageFile[item.href]), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
    });
  }

  // "Open Case", "Hold Queue", "Place Hold", "Merchant Exposure" and
  // "Chargeback Reporting" are no longer sidebar entries (Hold Queue is now
  // reached via Settlement & Payouts / Risk & Compliance at the same URL —
  // see navigation.ts) but every route/page still exists and must keep
  // independently enforcing its permission.
  const droppedFromNavButStillEnforced: Record<string, string> = {
    'new/page.tsx': 'chargebacks.manage',
    'holds/page.tsx': 'holds.view',
    'holds/new/page.tsx': 'holds.manage',
    'exposure/page.tsx': 'chargebacks.view',
    'reporting/page.tsx': 'chargebacks.view',
  };
  for (const [relativePath, permission] of Object.entries(droppedFromNavButStillEnforced)) {
    it(`${relativePath} (not in sidebar, but route still exists) requires '${permission}'`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('${permission}')`);
    });
  }

  it('the case detail page requires chargebacks.view', () => {
    const source = readFileSync(join(__dirname, '[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('chargebacks.view')`);
  });

  it('the hold detail page requires holds.view', () => {
    const source = readFileSync(join(__dirname, 'holds/[id]/page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('holds.view')`);
  });

  it('never gates a page behind roles.manage or users.manage', () => {
    const allFiles = [...Object.values(routeToPageFile), ...Object.keys(droppedFromNavButStillEnforced), '[id]/page.tsx', 'holds/[id]/page.tsx'];
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
});
