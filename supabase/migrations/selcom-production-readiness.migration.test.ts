// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(__dirname, '20260823000000_selcom_production_readiness.sql'), 'utf8');

function fnBody(name: string, nextMarker: string): string {
  return migration.slice(migration.indexOf(`create or replace function ${name}`), migration.indexOf(nextMarker));
}

describe('selcom_production.* permissions', () => {
  it('grants view to super_admin, cto, cfo, and compliance_security', () => {
    const superAdminBlock = migration.slice(
      migration.indexOf('insert into role_permissions (role_id, permission_id)\n  select'),
      migration.indexOf("insert into role_permissions (role_id, permission_id) values")
    );
    expect(superAdminBlock).toContain("'super_admin'");
    expect(superAdminBlock).toContain("id like 'selcom_production.%'");
    expect(migration).toContain("('cto', 'selcom_production.view')");
    expect(migration).toContain("('cfo', 'selcom_production.view')");
    expect(migration).toContain("('compliance_security', 'selcom_production.view')");
  });

  it('grants manage_checklist only to cto (and super_admin via the blanket block), never cfo or compliance_security', () => {
    expect(migration).toContain("('cto', 'selcom_production.manage_checklist')");
    expect(migration).not.toContain("('cfo', 'selcom_production.manage_checklist')");
    expect(migration).not.toContain("('compliance_security', 'selcom_production.manage_checklist')");
  });

  it('grants approve_finance only to cfo, approve_compliance only to compliance_security — never crossed', () => {
    expect(migration).toContain("('cfo', 'selcom_production.approve_finance')");
    expect(migration).not.toContain("('compliance_security', 'selcom_production.approve_finance')");
    expect(migration).toContain("('compliance_security', 'selcom_production.approve_compliance')");
    expect(migration).not.toContain("('cfo', 'selcom_production.approve_compliance')");
  });

  it('grants authorize only via the super_admin blanket block — no explicit non-super_admin grant exists', () => {
    expect(migration).not.toMatch(/\('cto', 'selcom_production\.authorize'\)/);
    expect(migration).not.toMatch(/\('cfo', 'selcom_production\.authorize'\)/);
    expect(migration).not.toMatch(/\('compliance_security', 'selcom_production\.authorize'\)/);
  });
});

describe('selcom_production_readiness_checks — 20 seeded items, no direct write policy', () => {
  it('seeds exactly 20 checklist items', () => {
    const seedBlock = migration.slice(
      migration.indexOf('insert into selcom_production_readiness_checks (item_key) values'),
      migration.indexOf("on conflict (item_key) do nothing")
    );
    const matches = seedBlock.match(/\('[a-z_]+'\)/g) ?? [];
    expect(matches.length).toBe(20);
  });

  it('has RLS enabled with only a select policy gated by selcom_production.view', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_production_readiness_checks'),
      migration.indexOf('insert into selcom_production_readiness_checks (item_key)')
    );
    expect(tableSection).toContain('enable row level security');
    expect(tableSection).toContain("has_permission('selcom_production.view')");
    expect(tableSection).not.toMatch(/for insert to authenticated/);
    expect(tableSection).not.toMatch(/for update to authenticated/);
  });

  it('status is constrained to the four documented states', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_production_readiness_checks'),
      migration.indexOf('insert into selcom_production_readiness_checks (item_key)')
    );
    expect(tableSection).toContain("check (status in ('not_started', 'passed', 'failed', 'not_applicable'))");
  });
});

describe('set_selcom_production_readiness_check — the only checklist writer', () => {
  const body = fnBody('set_selcom_production_readiness_check', 'record_selcom_production_finance_approval');

  it('requires selcom_production.manage_checklist and validates the status value', () => {
    expect(body).toContain("has_permission('selcom_production.manage_checklist')");
    expect(body).toContain("if p_status not in ('not_started', 'passed', 'failed', 'not_applicable')");
  });

  it('raises when the item_key does not exist rather than silently no-op-ing', () => {
    expect(body).toContain('if not found then');
    expect(body).toMatch(/raise exception 'Unknown production readiness checklist item/);
  });
});

describe('record_selcom_production_finance_approval / record_selcom_production_compliance_approval — separate approvals', () => {
  it('finance approval requires selcom_production.approve_finance and a non-empty reason', () => {
    const body = fnBody('record_selcom_production_finance_approval', 'create or replace function record_selcom_production_compliance_approval');
    expect(body).toContain("has_permission('selcom_production.approve_finance')");
    expect(body).toMatch(/A reason is required to record or revoke Finance approval/);
  });

  it('compliance approval requires selcom_production.approve_compliance and a non-empty reason, and is a fully separate function', () => {
    const body = fnBody('record_selcom_production_compliance_approval', '-- ── authorize_selcom_production_activation');
    expect(body).toContain("has_permission('selcom_production.approve_compliance')");
    expect(body).toMatch(/A reason is required to record or revoke Compliance approval/);
  });

  it('p_approved=false is a real code path (revocation), not just a boolean parameter with no branch for it', () => {
    const body = fnBody('record_selcom_production_finance_approval', 'create or replace function record_selcom_production_compliance_approval');
    expect(body).toContain('production_finance_approved = p_approved');
  });
});

describe('authorize_selcom_production_activation — the final gate re-verifies everything server-side', () => {
  const body = fnBody('authorize_selcom_production_activation', '-- ── merchant_payouts.environment');

  it('requires selcom_production.authorize and a non-empty reason', () => {
    expect(body).toContain("has_permission('selcom_production.authorize')");
    expect(body).toMatch(/A reason is required to authorize production activation/);
  });

  it('counts checklist items NOT in (passed, not_applicable) and refuses if any remain', () => {
    expect(body).toContain("where status not in ('passed', 'not_applicable')");
    expect(body).toContain('if v_incomplete_count > 0 then');
  });

  it('requires both Finance and Compliance approval to already be recorded, independently checked', () => {
    expect(body).toContain('if not v_settings.production_finance_approved then');
    expect(body).toContain('if not v_settings.production_compliance_approved then');
  });

  it('locks the settings row before checking approvals, to avoid a race with a concurrent revoke', () => {
    expect(body).toContain('for update');
  });

  it('never touches SELCOM_ENV, never calls any Selcom API, never creates a payout — purely a DB governance record', () => {
    expect(body).not.toMatch(/selcomRequest|getSelcomConfig|process\.env\.SELCOM_ENV/);
    expect(body).not.toMatch(/insert into merchant_payouts/);
  });
});

describe('deauthorize_selcom_production_activation — the safety valve', () => {
  const body = fnBody('deauthorize_selcom_production_activation', '-- ── merchant_payouts.environment');

  it('requires selcom_production.authorize (the same permission as authorizing) and a reason', () => {
    expect(body).toContain("has_permission('selcom_production.authorize')");
    expect(body).toMatch(/A reason is required to de-authorize production activation/);
  });

  it('records a distinct deauthorized_by/at/reason trail rather than just clearing the authorized fields silently', () => {
    expect(body).toContain('production_deauthorized_by = p_performed_by');
    expect(body).toContain('production_deauthorized_at = now()');
    expect(body).toContain('production_deauthorization_reason = p_reason');
  });
});

describe('merchant_payouts.environment — "never copy sandbox payout records into production records"', () => {
  it('adds the column with a safe sandbox default and a hard check constraint', () => {
    expect(migration).toContain("add column if not exists environment text not null default 'sandbox' check (environment in ('sandbox', 'production'))");
  });

  it('block_immutable_merchant_payout_mutation() freezes environment alongside amount/merchant_id/etc once a payout leaves pending_approval', () => {
    const body = fnBody('block_immutable_merchant_payout_mutation', '-- ── create_merchant_payouts_for_batch');
    expect(body).toContain('or new.environment is distinct from old.environment');
    expect(body).toMatch(/Payout amount, linkage, and environment are locked/);
  });

  it('create_merchant_payouts_for_batch requires the caller to supply a valid environment and stamps every inserted row with it', () => {
    const body = fnBody('create_merchant_payouts_for_batch', 'revoke execute on function create_merchant_payouts_for_batch');
    expect(body).toContain("if p_environment not in ('sandbox', 'production')");
    expect(body).toContain('destination_type, amount, currency, idempotency_key, requested_by, environment');
    expect(body).toMatch(/v_performer, p_environment/);
  });

  it('the old 1-argument create_merchant_payouts_for_batch(uuid) overload is explicitly dropped before the 2-argument version is created', () => {
    const dropIdx = migration.indexOf('drop function if exists create_merchant_payouts_for_batch(uuid);');
    const createIdx = migration.indexOf('create or replace function create_merchant_payouts_for_batch(p_batch_id uuid, p_environment text)');
    expect(dropIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(dropIdx);
  });
});

describe('every new mutating function is revoked from anon and public, granted only to authenticated', () => {
  it.each([
    ['set_selcom_production_readiness_check(text, text, text, text)'],
    ['record_selcom_production_finance_approval(boolean, text, text)'],
    ['record_selcom_production_compliance_approval(boolean, text, text)'],
    ['authorize_selcom_production_activation(text, text)'],
    ['deauthorize_selcom_production_activation(text, text)'],
    ['create_merchant_payouts_for_batch(uuid, text)'],
  ])('%s', (signature) => {
    expect(migration).toContain(`revoke execute on function ${signature} from public`);
    expect(migration).toContain(`grant execute on function ${signature} to authenticated`);
    expect(migration).toContain(`revoke execute on function ${signature} from anon`);
  });
});
