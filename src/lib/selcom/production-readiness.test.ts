// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_READINESS_ITEMS,
  PRODUCTION_READINESS_ITEM_KEYS,
  isChecklistComplete,
  type ProductionReadinessCheckRow,
} from './production-readiness';

function makeChecks(overrides: Partial<Record<string, ProductionReadinessCheckRow['status']>> = {}): ProductionReadinessCheckRow[] {
  return PRODUCTION_READINESS_ITEM_KEYS.map((key) => ({
    item_key: key,
    status: overrides[key] ?? 'passed',
    notes: null,
    checked_by: 'staff@bizlink.africa',
    checked_at: '2026-08-02T00:00:00.000Z',
  }));
}

describe('PRODUCTION_READINESS_ITEMS — the 20-item checklist', () => {
  it('has exactly 20 items, each with a unique key', () => {
    expect(PRODUCTION_READINESS_ITEMS.length).toBe(20);
    expect(new Set(PRODUCTION_READINESS_ITEM_KEYS).size).toBe(20);
  });

  it('every item has a non-empty label and description', () => {
    for (const item of PRODUCTION_READINESS_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});

describe('isChecklistComplete', () => {
  it('is true when every item is passed', () => {
    expect(isChecklistComplete(makeChecks())).toBe(true);
  });

  it('is true when every item is passed or not_applicable', () => {
    expect(isChecklistComplete(makeChecks({ production_ip_whitelist_confirmed: 'not_applicable' }))).toBe(true);
  });

  it('is false when any single item is not_started', () => {
    expect(isChecklistComplete(makeChecks({ rls_security_review_passed: 'not_started' }))).toBe(false);
  });

  it('is false when any single item is failed', () => {
    expect(isChecklistComplete(makeChecks({ maker_checker_test_passed: 'failed' }))).toBe(false);
  });

  it('is false when fewer than 20 rows are present at all (e.g. a seed migration has not run)', () => {
    expect(isChecklistComplete(makeChecks().slice(0, 19))).toBe(false);
  });

  it('is false for an empty checklist', () => {
    expect(isChecklistComplete([])).toBe(false);
  });
});
