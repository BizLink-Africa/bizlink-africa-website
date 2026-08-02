// Commission calculation engine. This file never calls Number() or
// parseFloat() on a money or percentage value — every calculation is done
// in exact integer (BigInt) arithmetic on minor units (cents for money,
// 1/10000ths of a percent for rates), then formatted back to a decimal
// string. This is the TypeScript-side half of the same guarantee the
// database enforces with numeric columns and GENERATED ALWAYS AS STORED
// columns elsewhere in this codebase (see src/lib/collections/money.ts).
//
// Tiered rules use a "cliff" model, not a progressive/marginal one: the
// full transaction amount is charged at the single percentage of whichever
// tier band it falls into (like a merchant volume-tier fee schedule), not
// split across bands the way income tax brackets are. Tier bands must be
// contiguous (enforced separately by validate_commission_fee_rule_tiers()
// in the database, which requires tier N's max_amount to equal tier N+1's
// min_amount) — min_amount is inclusive, max_amount is exclusive, so an
// amount sitting exactly on a boundary belongs to the higher tier. The
// final tier's max_amount is null (unbounded, effectively inclusive of
// everything above its min_amount).

const MONEY_DECIMALS = 2;
const PERCENTAGE_DECIMALS = 4;

export type CommissionType = 'percentage' | 'fixed' | 'tiered';

export interface CommissionTier {
  tierOrder: number;
  minAmount: string;
  maxAmount: string | null;
  tierPercentage: string;
}

export interface CommissionRuleInput {
  commissionType: CommissionType;
  percentageRate: string | null;
  fixedFeeAmount: string | null;
  minimumFee: string | null;
  maximumFee: string | null;
  settlementFee: string;
  monthlyTechnologyFee: string;
  tiers: CommissionTier[];
}

export interface CommissionCalculationResult {
  matchedTierOrder: number | null;
  baseCommission: string;
  clampedCommission: string;
  minimumFeeApplied: boolean;
  maximumFeeApplied: boolean;
  settlementFee: string;
  monthlyTechnologyFee: string;
  totalTransactionFees: string;
  netAmount: string;
}

function toMinorUnits(value: string, decimals: number): bigint {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid decimal value: "${value}"`);
  }
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const parts = unsigned.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid decimal value: "${value}"`);
  }
  const [wholePart, fractionPart = ''] = parts;
  if (!/^\d+$/.test(wholePart) || (fractionPart.length > 0 && !/^\d+$/.test(fractionPart)) || fractionPart.length > decimals) {
    throw new Error(`Invalid decimal value: "${value}"`);
  }
  const paddedFraction = fractionPart.padEnd(decimals, '0');
  const minor = BigInt(wholePart + paddedFraction);
  return negative ? -minor : minor;
}

// BigInt literals (e.g. `0n`) require an ES2020+ target; this project
// targets ES2017, so every bigint constant here is built via BigInt(...).
const ZERO = BigInt(0);
const TWO = BigInt(2);
const TEN = BigInt(10);

function fromMinorUnits(minor: bigint, decimals: number): string {
  const negative = minor < ZERO;
  const abs = negative ? -minor : minor;
  const s = abs.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  const fraction = s.slice(s.length - decimals);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

// Round-half-up integer division: floor((absN + absD/2) / absD), computed
// without ever forming a non-integer intermediate value.
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === ZERO) throw new Error('Division by zero');
  const negative = numerator < ZERO !== denominator < ZERO;
  const absN = numerator < ZERO ? -numerator : numerator;
  const absD = denominator < ZERO ? -denominator : denominator;
  const quotient = (TWO * absN + absD) / (TWO * absD);
  return negative ? -quotient : quotient;
}

// commissionMinor = amountMinor * ratePercent / 100, expressed purely in
// integer minor units: rate is stored as a 4-decimal-place integer (e.g.
// "2.5000" -> 25000n), so the combined divisor is 10^(PERCENTAGE_DECIMALS + 2).
function percentageOfAmount(amountMinor: bigint, ratePercentString: string): bigint {
  const rateMinor = toMinorUnits(ratePercentString, PERCENTAGE_DECIMALS);
  return divideRoundHalfUp(amountMinor * rateMinor, TEN ** BigInt(PERCENTAGE_DECIMALS + 2));
}

function findTier(tiers: CommissionTier[], amountMinor: bigint): CommissionTier | null {
  const sorted = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder);
  for (const tier of sorted) {
    const min = toMinorUnits(tier.minAmount, MONEY_DECIMALS);
    const max = tier.maxAmount === null ? null : toMinorUnits(tier.maxAmount, MONEY_DECIMALS);
    if (amountMinor >= min && (max === null || amountMinor < max)) {
      return tier;
    }
  }
  return null;
}

export function calculateCommission(rule: CommissionRuleInput, grossAmount: string): CommissionCalculationResult {
  const amountMinor = toMinorUnits(grossAmount, MONEY_DECIMALS);
  if (amountMinor < ZERO) {
    throw new Error('grossAmount must not be negative');
  }

  let baseCommissionMinor: bigint;
  let matchedTierOrder: number | null = null;

  if (rule.commissionType === 'percentage') {
    if (!rule.percentageRate) {
      throw new Error('percentageRate is required for a percentage rule');
    }
    baseCommissionMinor = percentageOfAmount(amountMinor, rule.percentageRate);
  } else if (rule.commissionType === 'fixed') {
    if (!rule.fixedFeeAmount) {
      throw new Error('fixedFeeAmount is required for a fixed rule');
    }
    baseCommissionMinor = toMinorUnits(rule.fixedFeeAmount, MONEY_DECIMALS);
  } else {
    if (rule.tiers.length === 0) {
      throw new Error('At least one tier is required for a tiered rule');
    }
    const matched = findTier(rule.tiers, amountMinor);
    if (!matched) {
      throw new Error(`No commission tier matches amount ${grossAmount}`);
    }
    matchedTierOrder = matched.tierOrder;
    baseCommissionMinor = percentageOfAmount(amountMinor, matched.tierPercentage);
  }

  let clampedMinor = baseCommissionMinor;
  let minimumFeeApplied = false;
  let maximumFeeApplied = false;

  if (rule.minimumFee) {
    const minFeeMinor = toMinorUnits(rule.minimumFee, MONEY_DECIMALS);
    if (clampedMinor < minFeeMinor) {
      clampedMinor = minFeeMinor;
      minimumFeeApplied = true;
    }
  }
  if (rule.maximumFee) {
    const maxFeeMinor = toMinorUnits(rule.maximumFee, MONEY_DECIMALS);
    if (clampedMinor > maxFeeMinor) {
      clampedMinor = maxFeeMinor;
      maximumFeeApplied = true;
    }
  }

  const settlementFeeMinor = toMinorUnits(rule.settlementFee || '0', MONEY_DECIMALS);
  const totalTransactionFeeMinor = clampedMinor + settlementFeeMinor;
  const netAmountMinor = amountMinor - totalTransactionFeeMinor;

  return {
    matchedTierOrder,
    baseCommission: fromMinorUnits(baseCommissionMinor, MONEY_DECIMALS),
    clampedCommission: fromMinorUnits(clampedMinor, MONEY_DECIMALS),
    minimumFeeApplied,
    maximumFeeApplied,
    settlementFee: fromMinorUnits(settlementFeeMinor, MONEY_DECIMALS),
    // Billed monthly, not deducted per transaction — passed through as-is
    // for display only, never included in netAmount below.
    monthlyTechnologyFee: rule.monthlyTechnologyFee || '0',
    totalTransactionFees: fromMinorUnits(totalTransactionFeeMinor, MONEY_DECIMALS),
    netAmount: fromMinorUnits(netAmountMinor, MONEY_DECIMALS),
  };
}
