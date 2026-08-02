import { describe, expect, it } from 'vitest';
import { calculateCommission, type CommissionRuleInput } from './calculate';

const baseRule: CommissionRuleInput = {
  commissionType: 'percentage',
  percentageRate: null,
  fixedFeeAmount: null,
  minimumFee: null,
  maximumFee: null,
  settlementFee: '0',
  monthlyTechnologyFee: '0',
  tiers: [],
};

describe('calculateCommission — percentage', () => {
  it('computes an exact percentage of the gross amount', () => {
    const result = calculateCommission({ ...baseRule, commissionType: 'percentage', percentageRate: '2.5000' }, '1000.00');
    expect(result.baseCommission).toBe('25.00');
    expect(result.clampedCommission).toBe('25.00');
  });

  it('rounds half up to the nearest cent rather than truncating', () => {
    // 100.00 * 1.005% = 1.005 -> rounds to 1.01, not 1.00
    const result = calculateCommission({ ...baseRule, percentageRate: '1.0050' }, '100.00');
    expect(result.baseCommission).toBe('1.01');
  });

  it('never produces the classic 0.1 + 0.2 float-style drift on repeated calculations', () => {
    // If this used JS floats, summing many small percentage calculations
    // would drift. BigInt minor-unit arithmetic must be exact every time.
    const rule = { ...baseRule, percentageRate: '3.3333' };
    const results = Array.from({ length: 20 }, () => calculateCommission(rule, '10.10').baseCommission);
    expect(new Set(results).size).toBe(1);
  });

  it('throws when percentageRate is missing', () => {
    expect(() => calculateCommission({ ...baseRule, percentageRate: null }, '100.00')).toThrow(/percentageRate is required/);
  });

  it('throws on a negative gross amount', () => {
    expect(() => calculateCommission({ ...baseRule, percentageRate: '2.0000' }, '-1.00')).toThrow(/must not be negative/);
  });
});

describe('calculateCommission — fixed', () => {
  it('charges the fixed fee regardless of the transaction amount', () => {
    const rule: CommissionRuleInput = { ...baseRule, commissionType: 'fixed', fixedFeeAmount: '500.00' };
    expect(calculateCommission(rule, '10.00').baseCommission).toBe('500.00');
    expect(calculateCommission(rule, '1000000.00').baseCommission).toBe('500.00');
  });

  it('throws when fixedFeeAmount is missing', () => {
    expect(() => calculateCommission({ ...baseRule, commissionType: 'fixed', fixedFeeAmount: null }, '100.00')).toThrow(
      /fixedFeeAmount is required/
    );
  });
});

describe('calculateCommission — tiered (cliff model: whole amount priced at its band\'s rate)', () => {
  const tieredRule: CommissionRuleInput = {
    ...baseRule,
    commissionType: 'tiered',
    tiers: [
      { tierOrder: 0, minAmount: '0.00', maxAmount: '100000.00', tierPercentage: '3.0000' },
      { tierOrder: 1, minAmount: '100000.00', maxAmount: '500000.00', tierPercentage: '2.0000' },
      { tierOrder: 2, minAmount: '500000.00', maxAmount: null, tierPercentage: '1.0000' },
    ],
  };

  it('applies the first tier for a low amount', () => {
    const result = calculateCommission(tieredRule, '50000.00');
    expect(result.matchedTierOrder).toBe(0);
    expect(result.baseCommission).toBe('1500.00'); // 3% of 50,000
  });

  it('applies the middle tier for a mid-range amount', () => {
    const result = calculateCommission(tieredRule, '250000.00');
    expect(result.matchedTierOrder).toBe(1);
    expect(result.baseCommission).toBe('5000.00'); // 2% of 250,000
  });

  it('applies the top (unbounded) tier for a large amount', () => {
    const result = calculateCommission(tieredRule, '2000000.00');
    expect(result.matchedTierOrder).toBe(2);
    expect(result.baseCommission).toBe('20000.00'); // 1% of 2,000,000
  });

  it('treats a boundary amount as belonging to the higher tier (min_amount is inclusive)', () => {
    const result = calculateCommission(tieredRule, '100000.00');
    expect(result.matchedTierOrder).toBe(1);
  });

  it('throws when no tier matches (gap or amount below the lowest tier)', () => {
    const rule: CommissionRuleInput = {
      ...baseRule,
      commissionType: 'tiered',
      tiers: [{ tierOrder: 0, minAmount: '1000.00', maxAmount: '2000.00', tierPercentage: '2.0000' }],
    };
    expect(() => calculateCommission(rule, '50.00')).toThrow(/No commission tier matches/);
  });

  it('throws when the rule has no tiers at all', () => {
    expect(() => calculateCommission({ ...baseRule, commissionType: 'tiered', tiers: [] }, '100.00')).toThrow(
      /At least one tier is required/
    );
  });
});

describe('calculateCommission — minimum fee', () => {
  it('clamps a small percentage commission up to the minimum fee', () => {
    const rule: CommissionRuleInput = { ...baseRule, percentageRate: '1.0000', minimumFee: '500.00' };
    const result = calculateCommission(rule, '1000.00'); // 1% of 1000 = 10.00, below the 500 minimum
    expect(result.baseCommission).toBe('10.00');
    expect(result.clampedCommission).toBe('500.00');
    expect(result.minimumFeeApplied).toBe(true);
    expect(result.maximumFeeApplied).toBe(false);
  });

  it('does not touch a commission already above the minimum', () => {
    const rule: CommissionRuleInput = { ...baseRule, percentageRate: '10.0000', minimumFee: '5.00' };
    const result = calculateCommission(rule, '1000.00'); // 10% of 1000 = 100.00
    expect(result.clampedCommission).toBe('100.00');
    expect(result.minimumFeeApplied).toBe(false);
  });
});

describe('calculateCommission — maximum fee', () => {
  it('clamps a large percentage commission down to the maximum fee', () => {
    const rule: CommissionRuleInput = { ...baseRule, percentageRate: '5.0000', maximumFee: '50000.00' };
    const result = calculateCommission(rule, '5000000.00'); // 5% of 5,000,000 = 250,000
    expect(result.baseCommission).toBe('250000.00');
    expect(result.clampedCommission).toBe('50000.00');
    expect(result.maximumFeeApplied).toBe(true);
    expect(result.minimumFeeApplied).toBe(false);
  });

  it('applies both minimum and maximum together, minimum first then maximum', () => {
    const rule: CommissionRuleInput = { ...baseRule, percentageRate: '50.0000', minimumFee: '10.00', maximumFee: '100.00' };
    const result = calculateCommission(rule, '1000.00'); // 50% of 1000 = 500, above both bounds
    expect(result.clampedCommission).toBe('100.00');
    expect(result.maximumFeeApplied).toBe(true);
  });
});

describe('calculateCommission — settlement fee, monthly technology fee, and net amount', () => {
  it('adds the settlement fee to the transaction-level total but keeps the monthly technology fee separate', () => {
    const rule: CommissionRuleInput = {
      ...baseRule,
      percentageRate: '2.0000',
      settlementFee: '200.00',
      monthlyTechnologyFee: '20000.00',
    };
    const result = calculateCommission(rule, '10000.00'); // 2% = 200.00 commission
    expect(result.baseCommission).toBe('200.00');
    expect(result.settlementFee).toBe('200.00');
    expect(result.totalTransactionFees).toBe('400.00'); // 200 commission + 200 settlement
    expect(result.monthlyTechnologyFee).toBe('20000.00');
    expect(result.netAmount).toBe('9600.00'); // 10000 - 400, monthly fee excluded
  });
});
