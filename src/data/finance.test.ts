import { describe, expect, it } from 'vitest';
import { formatMoney, computeTotals, aggregateLineItems, daysOverdue, AGING_BUCKETS, type FeeInputs } from './finance';

const zeroFees: FeeInputs = {
  setup_fee: 0,
  implementation_fee: 0,
  ai_automation_fee: 0,
  social_commerce_fee: 0,
  api_integration_fee: 0,
  subscription_fee: 0,
  support_fee: 0,
  consulting_fee: 0,
  maintenance_fee: 0,
  other_charges: 0,
  discount: 0,
  tax_percentage: 18,
};

describe('formatMoney', () => {
  it('renders a normal positive amount with 2 decimal places', () => {
    expect(formatMoney(1234.5, 'TZS')).toBe('TZS 1,234.50');
  });

  it('normalizes an exact negative zero to a positive zero', () => {
    expect(formatMoney(-0, 'TZS')).toBe('TZS 0.00');
  });

  it('normalizes a tiny negative float that rounds to zero at cent precision', () => {
    expect(formatMoney(-0.001, 'TZS')).toBe('TZS 0.00');
  });

  it('normalizes a negative-zero result from subtraction (e.g. spent - spent)', () => {
    const spent = 500;
    expect(formatMoney(-1 * (spent - spent), 'TZS')).toBe('TZS 0.00');
  });

  it('still renders genuine negative amounts with their sign', () => {
    expect(formatMoney(-250, 'TZS')).toBe('TZS -250.00');
  });

  it('renders a genuine positive zero unchanged', () => {
    expect(formatMoney(0, 'TZS')).toBe('TZS 0.00');
  });
});

describe('computeTotals — decimal money math', () => {
  it('sums all 10 fee categories (including consulting/maintenance) into the subtotal', () => {
    const totals = computeTotals({
      ...zeroFees,
      setup_fee: 100000,
      consulting_fee: 50000,
      maintenance_fee: 25000,
      tax_percentage: 18,
    });
    expect(totals.subtotal).toBe(175000);
    expect(totals.taxAmount).toBe(31500);
    expect(totals.total).toBe(206500);
  });

  it('applies discount before tax, never taxing the discounted amount', () => {
    const totals = computeTotals({ ...zeroFees, setup_fee: 100000, discount: 20000, tax_percentage: 18 });
    // taxable = 100000 - 20000 = 80000; tax = 14400; total = 94400
    expect(totals.taxAmount).toBe(14400);
    expect(totals.total).toBe(94400);
  });

  it('never lets a discount larger than the subtotal produce a negative taxable amount', () => {
    const totals = computeTotals({ ...zeroFees, setup_fee: 10000, discount: 50000, tax_percentage: 18 });
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(0);
  });

  it('rounds to cent precision, not raw floating point', () => {
    const totals = computeTotals({ ...zeroFees, setup_fee: 33.33, implementation_fee: 33.33, support_fee: 33.34, tax_percentage: 0 });
    expect(totals.subtotal).toBe(100);
  });
});

describe('aggregateLineItems — quantity x unit price rolled up by category', () => {
  it('sums multiple line items in the same category', () => {
    const totals = aggregateLineItems([
      { category: 'support_fee', description: 'Month 1 support', quantity: 1, unit_price: 50000 },
      { category: 'support_fee', description: 'Month 2 support', quantity: 1, unit_price: 50000 },
    ]);
    expect(totals.support_fee).toBe(100000);
  });

  it('keeps different categories independent', () => {
    const totals = aggregateLineItems([
      { category: 'consulting_fee', description: 'Strategy session', quantity: 2, unit_price: 75000 },
      { category: 'maintenance_fee', description: 'Monthly maintenance', quantity: 1, unit_price: 30000 },
    ]);
    expect(totals.consulting_fee).toBe(150000);
    expect(totals.maintenance_fee).toBe(30000);
    expect(totals.setup_fee).toBe(0);
  });

  it('returns zero for every category when there are no line items', () => {
    const totals = aggregateLineItems([]);
    expect(totals.setup_fee).toBe(0);
    expect(totals.other_charges).toBe(0);
  });

  it('rounds each line total to cent precision', () => {
    // 3 x 33.333 = 99.999, which rounds to 100.00 at cent precision.
    const totals = aggregateLineItems([{ category: 'api_integration_fee', description: 'x', quantity: 3, unit_price: 33.333 }]);
    expect(totals.api_integration_fee).toBe(100);
  });
});

describe('receivables aging — boundary days map to exactly one bucket', () => {
  const bucketFor = (days: number) => AGING_BUCKETS.find((b) => b.test(days))?.key;

  it('day 0 (due today) is current, not overdue', () => {
    expect(bucketFor(0)).toBe('current');
  });

  it('day 1 is the start of the 1-30 bucket', () => {
    expect(bucketFor(1)).toBe('b1');
  });

  it('day 30 is still the 1-30 bucket', () => {
    expect(bucketFor(30)).toBe('b1');
  });

  it('day 31 rolls into the 31-60 bucket', () => {
    expect(bucketFor(31)).toBe('b2');
  });

  it('day 60 is still the 31-60 bucket', () => {
    expect(bucketFor(60)).toBe('b2');
  });

  it('day 61 rolls into the 61-90 bucket', () => {
    expect(bucketFor(61)).toBe('b3');
  });

  it('day 90 is still the 61-90 bucket', () => {
    expect(bucketFor(90)).toBe('b3');
  });

  it('day 91 rolls into the 90+ bucket', () => {
    expect(bucketFor(91)).toBe('b4');
  });

  it('daysOverdue returns 0 for an invoice with no due date', () => {
    expect(daysOverdue(null, '2026-07-19')).toBe(0);
  });

  it('daysOverdue computes whole days between due date and today', () => {
    expect(daysOverdue('2026-07-01', '2026-07-19')).toBe(18);
  });

  it('daysOverdue is negative (not yet due) when the due date is in the future', () => {
    expect(daysOverdue('2026-08-01', '2026-07-19')).toBeLessThan(0);
  });
});
