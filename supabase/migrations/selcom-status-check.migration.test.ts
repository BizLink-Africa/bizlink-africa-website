// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Static assertions against the migration SQL text itself — same
// convention used by payouts-permissions.test.ts for the base payouts
// migration. These can't exercise the guards against a real database, but
// they lock in the specific safety properties the status-check-service
// task requires so a future edit can't silently drop one of them.

const migration = readFileSync(join(__dirname, '20260820000000_selcom_status_check_service.sql'), 'utf8');
const followUp = readFileSync(join(__dirname, '20260820010000_selcom_status_check_allow_unknown_on_submit.sql'), 'utf8');

describe('apply_payout_status_check_result — row locking and guards', () => {
  it('locks the payout row with FOR UPDATE before evaluating any guard', () => {
    const fnBody = migration.slice(
      migration.indexOf('create or replace function apply_payout_status_check_result'),
      migration.indexOf('create or replace function expire_payout_status_check')
    );
    expect(fnBody).toContain('for update');
  });

  it('guards against downgrading an already-terminal payout (successful/failed/reversed/cancelled/manual_review)', () => {
    const fnBody = migration.slice(
      migration.indexOf('create or replace function apply_payout_status_check_result'),
      migration.indexOf('create or replace function expire_payout_status_check')
    );
    expect(fnBody).toContain("v_terminal_statuses constant text[] := array['successful', 'failed', 'reversed', 'cancelled', 'manual_review']");
    expect(fnBody).toContain('if v_payout.status = any(v_terminal_statuses)');
    expect(fnBody).toContain("'payout_already_finalised'");
  });

  it('guards against an older/stale query overwriting a newer one, regardless of arrival order', () => {
    const fnBody = migration.slice(
      migration.indexOf('create or replace function apply_payout_status_check_result'),
      migration.indexOf('create or replace function expire_payout_status_check')
    );
    expect(fnBody).toContain('p_query_started_at < v_payout.last_status_check_started_at');
    expect(fnBody).toContain("'superseded_by_newer_check'");
  });

  it('only accepts the documented mapped statuses, never an arbitrary string', () => {
    const fnBody = migration.slice(
      migration.indexOf('create or replace function apply_payout_status_check_result'),
      migration.indexOf('create or replace function expire_payout_status_check')
    );
    expect(fnBody).toContain("if p_mapped_status not in ('processing', 'successful', 'failed', 'unknown')");
  });

  it('is callable by an authenticated staff member with payouts.submit or by the service-role cron key', () => {
    const fnBody = migration.slice(
      migration.indexOf('create or replace function apply_payout_status_check_result'),
      migration.indexOf('create or replace function expire_payout_status_check')
    );
    expect(fnBody).toContain("has_permission('payouts.submit') or auth.role() = 'service_role'");
  });

  it('is revoked from public/anon and only granted to authenticated', () => {
    expect(migration).toContain(
      'revoke execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) from public'
    );
    expect(migration).toContain(
      'grant execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) to authenticated'
    );
    expect(migration).toContain(
      'revoke execute on function apply_payout_status_check_result(uuid, timestamptz, text, text, text, text, text, text, integer, text) from anon'
    );
  });
});

describe('record_payout_status_check — every attempt is logged unconditionally', () => {
  it('has no outcome-dependent branching before the insert (always inserts, whatever the inputs are)', () => {
    const fnBody = migration.slice(
      migration.indexOf('create or replace function record_payout_status_check'),
      migration.indexOf('create or replace function apply_payout_status_check_result')
    );
    expect(fnBody).toContain('insert into merchant_payout_status_checks');
    expect(fnBody).not.toMatch(/if\s+p_query_succeeded/);
  });

  it('is callable by staff with payouts.view or the service-role cron key', () => {
    const fnBody = migration.slice(
      migration.indexOf('create or replace function record_payout_status_check'),
      migration.indexOf('create or replace function apply_payout_status_check_result')
    );
    expect(fnBody).toContain("has_permission('payouts.view') or auth.role() = 'service_role'");
  });
});

describe('merchant_payout_status_checks — no direct write policy', () => {
  it('has RLS enabled with only a select policy, no insert/update policy', () => {
    expect(migration).toContain('alter table merchant_payout_status_checks enable row level security');
    expect(migration).toContain('create policy "Staff can view payout status checks with permission"');
    expect(migration).not.toMatch(/create policy[^;]*merchant_payout_status_checks[^;]*for (insert|update)/);
  });
});

describe('expire_payout_status_check — stop polling after the configured window, move to Manual Review', () => {
  const fnBody = migration.slice(
    migration.indexOf('create or replace function expire_payout_status_check'),
    migration.indexOf('-- ── apply_merchant_payout_result')
  );

  it('locks the row, only acts on submitted/processing/unknown, and never touches anything transaction/disbursement-related', () => {
    expect(fnBody).toContain('for update');
    expect(fnBody).toContain("if v_payout.status not in ('submitted', 'processing', 'unknown')");
    expect(fnBody).not.toMatch(/transaction|disburs|selcom/i);
  });

  it("sets status to 'manual_review' and clears the polling schedule", () => {
    expect(fnBody).toContain("status = 'manual_review'");
    expect(fnBody).toContain('next_status_check_at = null');
  });

  it('records a moved_to_manual_review event', () => {
    expect(fnBody).toContain("'moved_to_manual_review'");
  });

  it('is revoked from public/anon and only granted to authenticated', () => {
    expect(migration).toContain('revoke execute on function expire_payout_status_check(uuid, text) from public');
    expect(migration).toContain('grant execute on function expire_payout_status_check(uuid, text) to authenticated');
    expect(migration).toContain('revoke execute on function expire_payout_status_check(uuid, text) from anon');
  });
});

describe('configurable polling window (requirement: stop polling after a configurable period)', () => {
  it('company_settings gains a configurable max-hours column with a sane default', () => {
    expect(migration).toContain('add column if not exists payout_status_check_max_hours integer not null default 48');
  });

  it('the partial index only covers pollable statuses, keeping the scheduler query cheap', () => {
    expect(migration).toContain('merchant_payouts_next_status_check_at_idx');
    expect(migration).toContain("where status in ('submitted', 'processing', 'unknown')");
  });
});

describe('apply_merchant_payout_result — signature kept identical across both migrations (no accidental overload)', () => {
  const signature = '(uuid, text, text, text, text, text, text, text, jsonb, text)';

  it('the follow-up migration re-declares the exact same parameter signature as the original', () => {
    const firstSig = migration.slice(
      migration.indexOf('create or replace function apply_merchant_payout_result'),
      migration.indexOf('returns void', migration.indexOf('create or replace function apply_merchant_payout_result'))
    );
    const secondSig = followUp.slice(
      followUp.indexOf('create or replace function apply_merchant_payout_result'),
      followUp.indexOf('returns void', followUp.indexOf('create or replace function apply_merchant_payout_result'))
    );
    // Strip whitespace differences before comparing parameter lists.
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(normalize(secondSig)).toBe(normalize(firstSig));
  });

  it('both migrations revoke/grant using the identical explicit signature (proof no new overload was introduced)', () => {
    for (const sql of [migration, followUp]) {
      expect(sql).toContain(`revoke execute on function apply_merchant_payout_result${signature} from public`);
      expect(sql).toContain(`grant execute on function apply_merchant_payout_result${signature} to authenticated`);
      expect(sql).toContain(`revoke execute on function apply_merchant_payout_result${signature} from anon`);
    }
  });

  it("the follow-up migration widens the accepted status list to include 'unknown'", () => {
    expect(migration).toContain("if p_status not in ('processing', 'successful', 'failed') then");
    expect(followUp).toContain("if p_status not in ('processing', 'successful', 'failed', 'unknown') then");
  });
});
