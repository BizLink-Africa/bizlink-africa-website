// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  INTERNAL_PAYOUT_STATUSES,
  TERMINAL_PAYOUT_STATUSES,
  SCHEDULED_POLL_ELIGIBLE_STATUSES,
  isTerminalPayoutStatus,
  isEligibleForScheduledPoll,
  getBackoffMinutes,
  BACKOFF_SCHEDULE_MINUTES,
  DEFAULT_STATUS_CHECK_MAX_HOURS,
} from './selcom-status-mapping';

// mapSelcomTransactionStatus() itself is covered in
// selcom-transaction-process.test.ts — this file covers the rest of the
// central configuration added for the status-check service: the full
// internal state list, terminal-state detection, scheduled-poll
// eligibility, and the backoff schedule.

describe('INTERNAL_PAYOUT_STATUSES — the full required state list', () => {
  it('contains every state the task requires', () => {
    for (const required of [
      'draft', 'pending_approval', 'approved', 'submitted', 'processing',
      'successful', 'failed', 'unknown', 'manual_review', 'reversed', 'cancelled',
    ]) {
      expect(INTERNAL_PAYOUT_STATUSES as readonly string[]).toContain(required);
    }
  });
});

describe('isTerminalPayoutStatus — never let a stale check downgrade a finalised payout', () => {
  it('treats successful, failed, reversed, cancelled, and manual_review as terminal', () => {
    for (const status of ['successful', 'failed', 'reversed', 'cancelled', 'manual_review']) {
      expect(isTerminalPayoutStatus(status)).toBe(true);
    }
  });

  it('does not treat non-final states as terminal', () => {
    for (const status of ['draft', 'pending_approval', 'approved', 'submitted', 'processing', 'unknown', 'held']) {
      expect(isTerminalPayoutStatus(status)).toBe(false);
    }
  });

  it('TERMINAL_PAYOUT_STATUSES matches isTerminalPayoutStatus exactly', () => {
    for (const status of INTERNAL_PAYOUT_STATUSES) {
      expect(isTerminalPayoutStatus(status)).toBe((TERMINAL_PAYOUT_STATUSES as readonly string[]).includes(status));
    }
  });
});

describe('isEligibleForScheduledPoll — exactly the requested set: Submitted, Processing, Unknown', () => {
  it('submitted, processing, and unknown are eligible', () => {
    expect(isEligibleForScheduledPoll('submitted')).toBe(true);
    expect(isEligibleForScheduledPoll('processing')).toBe(true);
    expect(isEligibleForScheduledPoll('unknown')).toBe(true);
  });

  it('terminal states and pre-submission states are never eligible', () => {
    for (const status of ['draft', 'pending_approval', 'approved', 'successful', 'failed', 'reversed', 'cancelled', 'manual_review', 'held']) {
      expect(isEligibleForScheduledPoll(status)).toBe(false);
    }
  });

  it('SCHEDULED_POLL_ELIGIBLE_STATUSES is a subset of the non-terminal statuses', () => {
    for (const status of SCHEDULED_POLL_ELIGIBLE_STATUSES) {
      expect(isTerminalPayoutStatus(status)).toBe(false);
    }
  });
});

describe('getBackoffMinutes — controlled backoff, never immediate re-checking', () => {
  it('starts at the shortest interval for the first check', () => {
    expect(getBackoffMinutes(0)).toBe(BACKOFF_SCHEDULE_MINUTES[0]);
  });

  it('increases monotonically with each subsequent check', () => {
    let previous = 0;
    for (let i = 0; i < BACKOFF_SCHEDULE_MINUTES.length; i++) {
      const minutes = getBackoffMinutes(i);
      expect(minutes).toBeGreaterThanOrEqual(previous);
      previous = minutes;
    }
  });

  it('caps at the last schedule entry rather than growing unbounded', () => {
    const capped = BACKOFF_SCHEDULE_MINUTES[BACKOFF_SCHEDULE_MINUTES.length - 1];
    expect(getBackoffMinutes(1000)).toBe(capped);
  });

  it('never returns a negative or zero interval for a negative count (defensive)', () => {
    expect(getBackoffMinutes(-5)).toBe(BACKOFF_SCHEDULE_MINUTES[0]);
  });
});

describe('DEFAULT_STATUS_CHECK_MAX_HOURS — configurable polling window default', () => {
  it('is a positive number of hours', () => {
    expect(DEFAULT_STATUS_CHECK_MAX_HOURS).toBeGreaterThan(0);
  });
});
