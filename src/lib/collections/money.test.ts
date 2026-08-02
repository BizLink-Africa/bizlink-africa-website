import { describe, expect, it } from 'vitest';
import { isValidMoneyString, formatMoney } from './money';

describe('isValidMoneyString — shape validation only, never used for calculation', () => {
  it('accepts whole numbers and up to 2 decimal places', () => {
    expect(isValidMoneyString('100')).toBe(true);
    expect(isValidMoneyString('100.5')).toBe(true);
    expect(isValidMoneyString('100.50')).toBe(true);
    expect(isValidMoneyString('0.01')).toBe(true);
  });

  it('rejects more than 2 decimal places, negative signs, and non-numeric input', () => {
    expect(isValidMoneyString('100.123')).toBe(false);
    expect(isValidMoneyString('-100')).toBe(false);
    expect(isValidMoneyString('abc')).toBe(false);
    expect(isValidMoneyString('')).toBe(false);
    expect(isValidMoneyString('1e10')).toBe(false);
  });

  it('does not silently coerce a value that looks like it could lose precision', () => {
    // The classic float trap: 0.1 + 0.2 !== 0.3 in JS. This module never
    // performs that addition — it only validates shape — but confirm the
    // validator itself doesn't try to parse-and-reformat (which would risk
    // exactly this class of bug).
    expect(isValidMoneyString('0.30')).toBe(true);
    expect(isValidMoneyString('999999999999.99')).toBe(true);
  });
});

describe('formatMoney — display-only formatting of an already-final value', () => {
  it('formats a decimal string with the given currency', () => {
    expect(formatMoney('1234.5', 'TZS')).toBe('TZS 1,234.50');
  });

  it('formats a Postgres-returned number the same way', () => {
    expect(formatMoney(1234.5, 'TZS')).toBe('TZS 1,234.50');
  });

  it('returns an em dash for null/undefined/empty rather than "TZS 0.00"', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney('')).toBe('—');
  });

  it('returns an em dash for a non-numeric value rather than throwing', () => {
    expect(formatMoney('not-a-number')).toBe('—');
  });
});
