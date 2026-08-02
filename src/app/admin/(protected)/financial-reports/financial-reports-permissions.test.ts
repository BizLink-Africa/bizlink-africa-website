// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

describe('Financial Reports — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Financial Reports');
  if (!group) throw new Error('Financial Reports group not found in navigation.ts');

  const routeToPageFile: Record<string, string> = {
    '/admin/financial-reports/daily-collections': 'daily-collections/page.tsx',
    '/admin/financial-reports/daily-reconciliation': 'daily-reconciliation/page.tsx',
    '/admin/financial-reports/merchant-settlement': 'merchant-settlement/page.tsx',
    '/admin/financial-reports/commission-revenue': 'commission-revenue/page.tsx',
    '/admin/financial-reports/outstanding-liabilities': 'outstanding-liabilities/page.tsx',
    '/admin/financial-reports/failed-payouts': 'failed-payouts/page.tsx',
    '/admin/financial-reports/chargebacks-reversals': 'chargebacks-reversals/page.tsx',
    '/admin/financial-reports/statements': 'statements/page.tsx',
    '/admin/financial-reports/audit-trail': 'audit-trail/page.tsx',
  };

  it('covers every Financial Reports nav item', () => {
    for (const item of group.items) {
      expect(routeToPageFile[item.href], `no known page file mapped for ${item.href}`).toBeDefined();
    }
    expect(Object.keys(routeToPageFile)).toHaveLength(group.items.length);
  });

  // "All Reports" (index), "Settlement Holds" (now under Settlement &
  // Payouts), "Beneficiary Changes" (now under Risk & Compliance) and
  // "Merchant KYC Status" are no longer sidebar entries here, but every
  // route/page still exists and must keep independently enforcing
  // financial_reports.view.
  const droppedFromNavButStillEnforced = [
    'page.tsx',
    'settlement-holds/page.tsx',
    'beneficiary-changes/page.tsx',
    'merchant-kyc-status/page.tsx',
  ];
  for (const relativePath of droppedFromNavButStillEnforced) {
    it(`${relativePath} (not in sidebar, but route still exists) requires 'financial_reports.view'`, () => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source).toContain(`requirePermission('financial_reports.view')`);
    });
  }

  for (const item of group.items) {
    it(`${item.label} (${item.href}) page.tsx requires '${item.permission}'`, () => {
      const source = readFileSync(join(__dirname, routeToPageFile[item.href]), 'utf8');
      expect(source).toContain(`requirePermission('${item.permission}')`);
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

  it('every export route requires financial_reports.view and logs an audit event ("log every export")', () => {
    for (const relativePath of exportRoutes) {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');
      expect(source, `${relativePath} missing permission check`).toContain(`requirePermission('financial_reports.view')`);
      expect(source, `${relativePath} missing audit log call`).toContain('logAuditEvent(');
    }
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
