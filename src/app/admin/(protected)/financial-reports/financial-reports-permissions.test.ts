// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

// Financial Reports modeled BizLink as the party generating merchant
// settlement/commission/payout reporting on funds it held. BizLink Africa
// does not receive, hold, reconcile, disburse or settle merchant funds, so
// this group was removed from active navigation and its routes are now
// gated Super Admin only behind the archived-financial-prototype layout —
// see navigation.ts and src/lib/archived-financial-prototype.ts. Nothing
// was deleted: every page.tsx and export route still independently
// enforces financial_reports.view, and the underlying DB grants (e.g. cfo
// holding financial_reports.view) were never revoked.
describe('Financial Reports — dissolved group, routes archived and Super-Admin gated', () => {
  it('is no longer present in NAV_GROUPS (stays caught if someone re-adds it without going through the archival process)', () => {
    const group = NAV_GROUPS.find((g) => g.label === 'Financial Reports');
    expect(group).toBeUndefined();
  });

  // Every page that used to be a sidebar item, plus the ones that were
  // already dropped from nav before this (index, settlement-holds,
  // beneficiary-changes, merchant-kyc-status) — all must still
  // independently enforce financial_reports.view.
  const pageFiles = [
    'page.tsx',
    'daily-collections/page.tsx',
    'daily-reconciliation/page.tsx',
    'merchant-settlement/page.tsx',
    'commission-revenue/page.tsx',
    'outstanding-liabilities/page.tsx',
    'failed-payouts/page.tsx',
    'chargebacks-reversals/page.tsx',
    'statements/page.tsx',
    'audit-trail/page.tsx',
    'settlement-holds/page.tsx',
    'beneficiary-changes/page.tsx',
    'merchant-kyc-status/page.tsx',
  ];
  for (const relativePath of pageFiles) {
    it(`${relativePath} still requires 'financial_reports.view', even though the module is no longer linked from the sidebar`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('financial_reports.view')`);
    });
  }

  const exportRoutes = [
    'statements/export/route.ts',
    'daily-collections/export/route.ts',
    'daily-reconciliation/export/route.ts',
    'merchant-settlement/export/route.ts',
    'commission-revenue/export/route.ts',
    'outstanding-liabilities/export/route.ts',
    'failed-payouts/export/route.ts',
    'chargebacks-reversals/export/route.ts',
    'settlement-holds/export/route.ts',
    'beneficiary-changes/export/route.ts',
    'merchant-kyc-status/export/route.ts',
    'audit-trail/export/route.ts',
  ];

  it('every export route still requires financial_reports.view and logs an audit event ("log every export")', () => {
    for (const relativePath of exportRoutes) {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source, `${relativePath} missing permission check`).toContain(`requirePermission('financial_reports.view')`);
      expect(source, `${relativePath} missing audit log call`).toContain('logAuditEvent(');
    }
  });

  it('layout.tsx wires up the archived-prototype access gate (Super Admin only)', () => {
    const source = readFileSync(join(__dirname, 'layout.tsx'), 'utf8');
    expect(source).toContain('checkArchivedFinancialPrototypeAccess');
  });

  it('is only ever granted to super_admin and cfo in the migration ("Super Admin and authorised Finance roles")', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260814000000_create_merchant_statements_financial_reports.sql'),
      'utf8'
    );
    for (const role of ['operations', 'customer_support', 'auditor', 'cto', 'marketing', 'compliance_security', 'ceo']) {
      expect(migration).not.toContain(`('${role}', 'financial_reports`);
    }
    expect(migration).toContain(`('cfo', 'financial_reports.view')`);
  });

  it('generate_merchant_statement() is revoked from anon and dual-checks staff vs. the merchant\'s own merchant_users row', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260814000000_create_merchant_statements_financial_reports.sql'),
      'utf8'
    );
    expect(migration).toContain('revoke execute on function generate_merchant_statement(uuid, date, date) from anon');
    expect(migration).toContain('v_is_staff := has_permission');
    expect(migration).toContain('merchant_users where user_id = auth.uid() and merchant_id = p_merchant_id');
  });

  it('never queries commission_fee_rules — "do not expose confidential partner rates" (the header comment names the table only to explain that, which this checks for separately)', () => {
    const migration = readFileSync(
      join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260814000000_create_merchant_statements_financial_reports.sql'),
      'utf8'
    );
    expect(migration).not.toMatch(/from\s+commission_fee_rules/i);
    expect(migration).not.toMatch(/join\s+commission_fee_rules/i);
  });
});
