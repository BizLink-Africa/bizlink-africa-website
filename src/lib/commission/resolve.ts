import type { CommissionFeeRule } from '@/data/commission';

// Picks the single winning rule for a merchant/service/date combination out
// of a set of already-approved candidates. Most specific scope wins
// (merchant+service > merchant-only > service-only > global default);
// ties broken by the most recent effective_date. Pure and DB-free so it can
// be unit tested directly — the caller (previewCommissionCalculation in
// actions.ts) is responsible for only ever passing rows with status
// 'approved'.
export function resolveApplicableCommissionRule(
  rules: CommissionFeeRule[],
  params: { merchantId: string | null; serviceKey: string | null; asOfDate: string }
): CommissionFeeRule | null {
  const candidates = rules.filter((rule) => {
    if (rule.status !== 'approved') return false;
    if (rule.effective_date > params.asOfDate) return false;
    if (rule.expiry_date && rule.expiry_date < params.asOfDate) return false;
    const merchantMatches = rule.merchant_id === null || rule.merchant_id === params.merchantId;
    const serviceMatches = rule.service_key === null || rule.service_key === params.serviceKey;
    return merchantMatches && serviceMatches;
  });

  if (candidates.length === 0) return null;

  function specificity(rule: CommissionFeeRule): number {
    let score = 0;
    if (rule.merchant_id !== null) score += 2;
    if (rule.service_key !== null) score += 1;
    return score;
  }

  candidates.sort((a, b) => {
    const specDiff = specificity(b) - specificity(a);
    if (specDiff !== 0) return specDiff;
    return b.effective_date.localeCompare(a.effective_date);
  });

  return candidates[0];
}
