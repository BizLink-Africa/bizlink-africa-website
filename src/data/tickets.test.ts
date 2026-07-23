import { describe, expect, it } from 'vitest';
import { computeSlaState } from './tickets';

const NOW = new Date('2026-07-19T12:00:00.000Z');

describe('computeSlaState — priority-based SLA deadlines', () => {
  it('returns null when there is no deadline to measure against', () => {
    expect(computeSlaState(null, null, NOW)).toBeNull();
  });

  it('is "met" when the thing was achieved before its deadline', () => {
    const deadline = '2026-07-19T14:00:00.000Z';
    const achievedAt = '2026-07-19T13:00:00.000Z';
    expect(computeSlaState(deadline, achievedAt, NOW)).toBe('met');
  });

  it('is "breached" when the thing was achieved after its deadline', () => {
    const deadline = '2026-07-19T10:00:00.000Z';
    const achievedAt = '2026-07-19T11:00:00.000Z';
    expect(computeSlaState(deadline, achievedAt, NOW)).toBe('breached');
  });

  it('is "breached" when the deadline has already passed and nothing was achieved yet', () => {
    const deadline = '2026-07-19T11:00:00.000Z'; // 1 hour before NOW
    expect(computeSlaState(deadline, null, NOW)).toBe('breached');
  });

  it('is "due_soon" within the 2-hour warning window before the deadline', () => {
    const deadline = '2026-07-19T13:30:00.000Z'; // 1.5 hours after NOW
    expect(computeSlaState(deadline, null, NOW)).toBe('due_soon');
  });

  it('is "on_track" comfortably before the deadline', () => {
    const deadline = '2026-07-19T20:00:00.000Z'; // 8 hours after NOW
    expect(computeSlaState(deadline, null, NOW)).toBe('on_track');
  });

  it('sits exactly on the due_soon boundary (2 hours out) as due_soon, not on_track', () => {
    const deadline = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
    expect(computeSlaState(deadline, null, NOW)).toBe('due_soon');
  });

  it('sits one millisecond past the deadline as breached, not due_soon', () => {
    const deadline = new Date(NOW.getTime() - 1).toISOString();
    expect(computeSlaState(deadline, null, NOW)).toBe('breached');
  });
});
