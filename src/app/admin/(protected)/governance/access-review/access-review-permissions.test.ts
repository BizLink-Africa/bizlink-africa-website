// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

const RBAC_MIGRATION = join(__dirname, '..', '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260815000000_extend_rbac_finance_operations.sql');
const AUDITOR_GRANT_MIGRATION = join(__dirname, '..', '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260816000000_grant_auditor_access_review.sql');

describe('Role & Access Review page — sidebar permission matches page enforcement', () => {
  const group = NAV_GROUPS.find((g) => g.label === 'Governance');
  if (!group) throw new Error('Governance group not found in navigation.ts');

  it('the nav item exists and points at access_reviews.view', () => {
    const item = group.items.find((i) => i.href === '/admin/governance/access-review');
    expect(item, 'Role & Access Review nav item not found').toBeDefined();
    expect(item?.permission).toBe('access_reviews.view');
  });

  it('page.tsx requires access_reviews.view', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('access_reviews.view')`);
  });

  it('auditor is granted access_reviews.view (read-only oversight of role assignments + privileged actions)', () => {
    const migration = readFileSync(AUDITOR_GRANT_MIGRATION, 'utf8');
    expect(migration).toContain(`('auditor', 'access_reviews.view')`);
  });
});

describe('RBAC extension migration — separation of duties between Finance Maker / Checker / Approver', () => {
  const migration = readFileSync(RBAC_MIGRATION, 'utf8');

  it('Finance Maker never holds an approve/resolve/process/emergency/hold permission ("cannot approve their own batch")', () => {
    const makerBlockStart = migration.indexOf("('finance_maker', 'settlement.view')");
    const makerBlockEnd = migration.indexOf('on conflict do nothing;', makerBlockStart);
    const makerBlock = migration.slice(makerBlockStart, makerBlockEnd);
    for (const forbidden of ['settlement.approve', 'settlement.process', 'settlement.emergency', 'settlement.compliance_hold', 'payouts.approve', 'payouts.submit', 'commission_rules.approve', 'chargebacks.resolve', 'reversals.approve']) {
      expect(makerBlock, `finance_maker must not hold ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('Finance Checker never holds settlement.prepare, payouts.manage or a final-approval permission ("cannot create beneficiary changes they approve")', () => {
    const checkerBlockStart = migration.indexOf("('finance_checker', 'settlement.view')");
    const checkerBlockEnd = migration.indexOf('on conflict do nothing;', checkerBlockStart);
    const checkerBlock = migration.slice(checkerBlockStart, checkerBlockEnd);
    for (const forbidden of ['settlement.prepare', 'settlement.approve', 'settlement.process', 'payouts.manage', 'payouts.approve', 'payouts.submit', 'chargebacks.resolve']) {
      expect(checkerBlock, `finance_checker must not hold ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('Finance Approver never holds settlement.prepare or payouts.manage (never the original requester)', () => {
    const approverBlockStart = migration.indexOf("('finance_approver', 'settlement.view')");
    const approverBlockEnd = migration.indexOf('on conflict do nothing;', approverBlockStart);
    const approverBlock = migration.slice(approverBlockStart, approverBlockEnd);
    for (const forbidden of ['settlement.prepare', 'payouts.manage', 'settlement.compliance_hold']) {
      expect(approverBlock, `finance_approver must not hold ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('Technical Staff (cto) and Support Agent (customer_support) hold no settlement approval permission ("Technical Staff cannot approve settlements", "Support Agent cannot access ... full financial details")', () => {
    for (const role of ['cto', 'customer_support']) {
      expect(migration).not.toContain(`('${role}', 'settlement.approve')`);
      expect(migration).not.toContain(`('${role}', 'settlement.prepare')`);
    }
  });

  it('Auditor is granted only .view permissions across the new finance modules ("Auditor is read-only")', () => {
    const auditorBlockStart = migration.indexOf("('auditor', 'settlement.view')");
    const auditorBlockEnd = migration.indexOf('on conflict do nothing;', auditorBlockStart);
    const auditorBlock = migration.slice(auditorBlockStart, auditorBlockEnd);
    const grants = auditorBlock.match(/\('auditor', '[\w.]+'\)/g) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant.endsWith(".view')"), `${grant} is not a .view permission`).toBe(true);
    }
  });

  it('Merchant User self-service RLS is scoped through merchant_users, never a blanket authenticated policy ("sees only their own business, transactions, payouts and statements")', () => {
    expect(migration).toContain('create policy "Merchant can view own transactions"');
    expect(migration).toContain('create policy "Merchant can view own payouts"');
    expect(migration).toMatch(/on collection_transactions for select to authenticated[\s\S]{0,200}merchant_users/);
    expect(migration).toMatch(/on merchant_payouts for select to authenticated[\s\S]{0,200}merchant_users/);
  });

  it('audit_logs gains role/reason/ip_address/user_agent/correlation_id columns ("Record actor, role, action, module, record, old values, new values, reason, timestamp, IP, user agent, correlation ID")', () => {
    for (const column of ['role text', 'reason text', 'ip_address text', 'user_agent text', 'correlation_id text']) {
      expect(migration).toContain(`add column if not exists ${column}`);
    }
  });

  it('financial and compliance audit log rows are append-only ("append-only where practical")', () => {
    expect(migration).toContain('block_financial_audit_log_mutation');
    expect(migration).toContain("record_type in ('finance', 'compliance')");
    expect(migration).toContain('before update or delete on audit_logs');
  });
});
