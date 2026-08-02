// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(__dirname, '20260822000000_selcom_disbursement_balance.sql'), 'utf8');

function fnBody(name: string, nextMarker: string): string {
  return migration.slice(migration.indexOf(`create or replace function ${name}`), migration.indexOf(nextMarker));
}

describe('disbursement_balance permissions — view is broader than refresh', () => {
  it('grants view to cfo, cto, and finance_approver', () => {
    expect(migration).toContain("('cfo', 'disbursement_balance.view')");
    expect(migration).toContain("('cto', 'disbursement_balance.view')");
    expect(migration).toContain("('finance_approver', 'disbursement_balance.view')");
  });

  it('grants refresh only to finance_approver — never cfo or cto directly', () => {
    expect(migration).toContain("('finance_approver', 'disbursement_balance.refresh')");
    expect(migration).not.toContain("('cfo', 'disbursement_balance.refresh')");
    expect(migration).not.toContain("('cto', 'disbursement_balance.refresh')");
  });

  it('grants both to super_admin via the generic all-permissions block', () => {
    const block = migration.slice(migration.indexOf('insert into role_permissions (role_id, permission_id)\n  select'), migration.indexOf('insert into role_permissions (role_id, permission_id) values'));
    expect(block).toContain("'super_admin'");
    expect(block).toContain("'disbursement_balance.view'");
    expect(block).toContain("'disbursement_balance.refresh'");
  });
});

describe('selcom_balance_snapshot — the reservation lock target and display cache', () => {
  it('is a true singleton (boolean primary key, seeded row)', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_balance_snapshot'),
      migration.indexOf('create table if not exists selcom_balance_checks')
    );
    expect(tableSection).toContain('id boolean primary key default true check (id)');
    expect(tableSection).toContain('insert into selcom_balance_snapshot (id) values (true)');
  });

  it('has RLS enabled with only a select policy, no insert/update policy', () => {
    const tableSection = migration.slice(
      migration.indexOf('create table if not exists selcom_balance_snapshot'),
      migration.indexOf('create table if not exists selcom_balance_checks')
    );
    expect(tableSection).toContain('alter table selcom_balance_snapshot enable row level security');
    expect(tableSection).toContain("has_permission('disbursement_balance.view')");
    expect(tableSection).not.toMatch(/for insert to authenticated/);
    expect(tableSection).not.toMatch(/for update to authenticated/);
  });
});

describe('reserve_selcom_balance_for_batch — the atomic reservation guard', () => {
  const body = fnBody('reserve_selcom_balance_for_batch', '-- ── maybe_release_batch_reservation');

  it('locks the shared selcom_balance_snapshot row before computing anything — the global serialization point', () => {
    const lockIdx = body.indexOf('for update');
    const sumIdx = body.indexOf('coalesce(sum(reserved_amount)');
    expect(lockIdx).toBeGreaterThan(-1);
    expect(sumIdx).toBeGreaterThan(lockIdx);
  });

  it('is idempotent — a batch that already has a reservation is never reserved twice', () => {
    expect(body).toContain('exists (select 1 from selcom_balance_reservations where batch_id = p_batch_id)');
  });

  it('rejects when available balance minus already-reserved funds cannot cover this batch', () => {
    expect(body).toContain('p_available_balance - v_already_reserved < v_batch.merchant_net_total');
    expect(body).toMatch(/raise exception 'Insufficient cleared Selcom disbursement balance/);
  });

  it('reserves exactly the batch\'s merchant_net_total, not an app-supplied amount', () => {
    expect(body).toContain('values (p_batch_id, v_batch.merchant_net_total, p_performed_by)');
  });

  it('is revoked from public/anon and only granted to authenticated', () => {
    expect(migration).toContain('revoke execute on function reserve_selcom_balance_for_batch(uuid, numeric, text) from public');
    expect(migration).toContain('grant execute on function reserve_selcom_balance_for_batch(uuid, numeric, text) to authenticated');
    expect(migration).toContain('revoke execute on function reserve_selcom_balance_for_batch(uuid, numeric, text) from anon');
  });
});

describe('approve_settlement_batch — widened signature, balance-gated finalisation', () => {
  it('explicitly drops the old 2-parameter overload before recreating with 3 parameters', () => {
    const dropIdx = migration.indexOf('drop function if exists approve_settlement_batch(uuid, text)');
    const createIdx = migration.indexOf('create or replace function approve_settlement_batch(p_batch_id uuid, p_approval_notes text, p_available_balance numeric)');
    expect(dropIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(dropIdx);
  });

  const body = fnBody('approve_settlement_batch(p_batch_id', '-- ── Hook the auto-release');

  it('only reserves funds on the call that actually finalises the batch, not the first of a dual-approval pair', () => {
    expect(body).toContain('v_will_finalize := v_batch.approved_by is not null or not v_batch.requires_dual_approval');
    expect(body).toContain('if v_will_finalize then');
    expect(body).toContain('perform reserve_selcom_balance_for_batch(p_batch_id, p_available_balance, v_performer)');
  });

  it('still enforces every pre-existing maker-checker/compliance-hold check', () => {
    expect(body).toContain("has_permission('settlement.approve')");
    expect(body).toContain('compliance_hold');
    expect(body).toContain('Maker-checker violation: the approver must be different from the preparer');
    expect(body).toContain('Maker-checker violation: the second approver must be different from the first approver');
  });

  it('is revoked from public/anon and only granted to authenticated', () => {
    expect(migration).toContain('revoke execute on function approve_settlement_batch(uuid, text, numeric) from public');
    expect(migration).toContain('grant execute on function approve_settlement_batch(uuid, text, numeric) to authenticated');
    expect(migration).toContain('revoke execute on function approve_settlement_batch(uuid, text, numeric) from anon');
  });
});

describe('maybe_release_batch_reservation — auto-release once every payout in a batch is resolved', () => {
  const body = fnBody('maybe_release_batch_reservation', '-- ── release_selcom_balance_reservation');

  it('only releases when there are zero payouts still in a non-terminal status for the batch', () => {
    expect(body).toContain("status not in ('successful', 'failed', 'reversed', 'cancelled', 'manual_review')");
    expect(body).toContain('if v_unresolved_count = 0 then');
  });

  it('only ever marks a reservation consumed, never touches merchant_payouts or settlement_batches', () => {
    expect(body).toContain("set status = 'consumed', released_at = now()");
    expect(body).not.toMatch(/update merchant_payouts/);
    expect(body).not.toMatch(/update settlement_batches/);
  });

  it('is never exposed as a direct RPC entrypoint — revoked from every role', () => {
    expect(migration).toContain('revoke execute on function maybe_release_batch_reservation(uuid) from public');
    expect(migration).toContain('revoke execute on function maybe_release_batch_reservation(uuid) from authenticated');
    expect(migration).toContain('revoke execute on function maybe_release_batch_reservation(uuid) from anon');
  });

  it('is wired into every function that can move a payout to a terminal status', () => {
    for (const caller of ['apply_merchant_payout_result', 'apply_payout_status_check_result', 'process_selcom_callback']) {
      const callerBody = migration.slice(
        migration.indexOf(`create or replace function ${caller}`),
        migration.indexOf(`revoke execute on function ${caller}`)
      );
      expect(callerBody, `${caller} should call maybe_release_batch_reservation`).toContain('perform maybe_release_batch_reservation(');
    }
  });
});

describe('release_selcom_balance_reservation — manual Finance override', () => {
  const body = fnBody('release_selcom_balance_reservation', '-- ── approve_settlement_batch');

  it('requires disbursement_balance.refresh and a non-empty reason', () => {
    expect(body).toContain("has_permission('disbursement_balance.refresh')");
    expect(body).toContain('A reason is required to release a balance reservation');
  });

  it('never touches merchant_payouts or settlement_batches', () => {
    expect(body).not.toMatch(/update merchant_payouts/);
    expect(body).not.toMatch(/update settlement_batches/);
  });
});

describe('record_selcom_balance_check — the only writer of the snapshot and history', () => {
  const body = fnBody('record_selcom_balance_check', '-- ── reserve_selcom_balance_for_batch');

  it('always inserts into the history table regardless of success/failure', () => {
    expect(body).toContain('insert into selcom_balance_checks');
  });

  it('only updates the cached snapshot when the query actually succeeded', () => {
    expect(body).toContain('if p_query_succeeded then');
    expect(body).toContain('update selcom_balance_snapshot set');
  });

  it('requires disbursement_balance.refresh', () => {
    expect(body).toContain("has_permission('disbursement_balance.refresh')");
  });
});
