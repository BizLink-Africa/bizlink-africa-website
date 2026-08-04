// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV_GROUPS } from '@/data/navigation';

const PAGE_PATH = join(__dirname, 'page.tsx');

// Replaces the retired Selcom production-disbursement readiness workflow
// with a provider-neutral integration health page for day-to-day use. See
// docs/SELCOM_PRODUCTION_READINESS_REPORT.md's "Disbursement Integration
// Retired" section and
// src/app/admin/(protected)/settings/integrations/selcom/production-readiness/page.tsx
// (preserved read-only, Super Admin only, for audit history).
describe('Payment Integration Health — provider-neutral, no payout content', () => {
  const source = readFileSync(PAGE_PATH, 'utf8');

  it('requires integrations.view to render (not a new permission, not Super-Admin-only — this is active, ongoing functionality)', () => {
    expect(source).toContain(`requirePermission('integrations.view')`);
  });

  it('is registered at the recommended route in NAV_GROUPS, under Services', () => {
    const group = NAV_GROUPS.find((g) => g.label === 'Services');
    expect(group).toBeDefined();
    const item = group?.items.find((i) => i.href === '/admin/settings/integrations/payment-infrastructure');
    expect(item).toBeDefined();
    expect(item?.permission).toBe('integrations.view');
  });

  it('shows the exact required compliance card text', () => {
    expect(source).toContain(
      'BizLink Africa provides payment-integration and technical support only. Each merchant manages their own payment account and settlement directly with the approved payment partner. BizLink Africa does not hold or settle merchant funds.'
    );
  });

  it('shows every required field', () => {
    const required = [
      'Integration Environment',
      'API Connection Status',
      'Callback Status',
      'Merchant Account/Till Status',
      'Last Successful API Request',
      'Last Failed API Request',
      'Transaction-Status Monitoring',
      'Credential Configured',
      'Technical Documentation Status',
      'Support Escalation Status',
      'Integration Logs',
    ];
    for (const label of required) {
      expect(source, `missing required field: ${label}`).toContain(label);
    }
  });

  it('never shows production payout activation, finance/compliance payout approval, settlement-batch readiness, disbursement balance, live-payout enablement, or beneficiary payout verification', () => {
    const forbidden = [
      /production activation/i,
      /finance approval/i,
      /compliance approval/i,
      /settlement.?batch/i,
      /disbursement balance/i,
      /live.?payout/i,
      /beneficiary.*verif/i,
      /authorize/i,
    ];
    for (const pattern of forbidden) {
      expect(source, `forbidden content matched: ${pattern}`).not.toMatch(pattern);
    }
  });

  it('never queries a settlement, payout, commission, collection, chargeback, or beneficiary table', () => {
    const archivedTables = [
      'settlement_batches', 'merchant_payouts', 'commission_fee_rules', 'collection_transactions',
      'chargeback_cases', 'merchant_settlement_beneficiaries', 'merchant_beneficiary_change_requests',
      'merchant_beneficiary_lookups', 'selcom_balance_snapshot', 'selcom_balance_reservations',
      'selcom_production_readiness_checks',
    ];
    for (const table of archivedTables) {
      expect(source, `must not query archived table: ${table}`).not.toContain(`'${table}'`);
    }
  });

  it('never displays the disbursement account (masked or otherwise) or production credential fields', () => {
    expect(source).not.toContain('maskedDisbursementAccount');
    expect(source).not.toContain('maskedProductionApiKey');
    expect(source).not.toContain('maskedProductionDisbursementAccount');
    expect(source).not.toContain('productionCredentialStatus');
    expect(source).not.toContain('productionCallbackConfigured');
  });

  it('excludes balance/production-activation events from the visible integration log', () => {
    expect(source).not.toContain("'balance_check'");
    expect(source).not.toContain("'balance_refresh'");
    expect(source).not.toContain("'production_activation_requested'");
  });
});

describe('the old production-readiness route is not broken and is not redirected', () => {
  const OLD_PAGE_PATH = join(__dirname, '..', 'selcom', 'production-readiness', 'page.tsx');

  it('still exists at its original route and still enforces selcom_production.view', () => {
    const source = readFileSync(OLD_PAGE_PATH, 'utf8');
    expect(source).toContain(`requirePermission('selcom_production.view')`);
  });

  it('links forward to the new Payment Integration Health page', () => {
    const source = readFileSync(OLD_PAGE_PATH, 'utf8');
    expect(source).toContain('/admin/settings/integrations/payment-infrastructure');
  });
});
