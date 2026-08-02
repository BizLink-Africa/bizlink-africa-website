'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCommissionFeeRule, type NewRuleTierInput } from '@/app/admin/(protected)/commission-rules/actions';
import { COMMISSION_TYPES, type CommissionType } from '@/data/commission';
import { SERVICE_CATALOG } from '@/data/services';

const inputClass = 'border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

export default function NewRuleForm({
  merchants,
  contracts,
}: {
  merchants: { id: string; business_name: string }[];
  contracts: { id: string; contract_number: string; contract_title: string }[];
}) {
  const router = useRouter();
  const [commissionType, setCommissionType] = useState<CommissionType>('percentage');
  const [percentageRate, setPercentageRate] = useState('');
  const [fixedFeeAmount, setFixedFeeAmount] = useState('');
  const [minimumFee, setMinimumFee] = useState('');
  const [maximumFee, setMaximumFee] = useState('');
  const [settlementFee, setSettlementFee] = useState('0');
  const [monthlyTechnologyFee, setMonthlyTechnologyFee] = useState('0');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [contractId, setContractId] = useState('');
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [tiers, setTiers] = useState<NewRuleTierInput[]>([{ tierOrder: 0, minAmount: '0.00', maxAmount: null, tierPercentage: '' }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addTier() {
    setTiers((prev) => [...prev, { tierOrder: prev.length, minAmount: prev.at(-1)?.maxAmount ?? '', maxAmount: null, tierPercentage: '' }]);
  }
  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, tierOrder: i })));
  }
  function updateTier(index: number, patch: Partial<NewRuleTierInput>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await createCommissionFeeRule({
      commissionType,
      percentageRate: commissionType === 'percentage' ? percentageRate : null,
      fixedFeeAmount: commissionType === 'fixed' ? fixedFeeAmount : null,
      minimumFee: minimumFee || null,
      maximumFee: maximumFee || null,
      settlementFee: settlementFee || '0',
      monthlyTechnologyFee: monthlyTechnologyFee || '0',
      currency: 'TZS',
      effectiveDate,
      expiryDate: expiryDate || null,
      merchantId: merchantId || null,
      serviceKey: serviceKey || null,
      contractId: contractId || null,
      allowOverlap,
      changeReason,
      tiers: commissionType === 'tiered' ? tiers : [],
    });

    setPending(false);
    if (!result.success && !result.ruleId) {
      setError(result.message ?? 'Failed to create the rule.');
      return;
    }
    if (result.ruleId) {
      router.push(`/admin/commission-rules/${result.ruleId}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-6 space-y-5 max-w-3xl">
      <div>
        <label className={labelClass}>Commission Type</label>
        <select value={commissionType} onChange={(e) => setCommissionType(e.target.value as CommissionType)} className={inputClass}>
          {COMMISSION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {commissionType === 'percentage' && (
        <div>
          <label className={labelClass}>Percentage Rate (%)</label>
          <input type="text" value={percentageRate} onChange={(e) => setPercentageRate(e.target.value)} placeholder="e.g. 2.5000" required className={inputClass} />
        </div>
      )}

      {commissionType === 'fixed' && (
        <div>
          <label className={labelClass}>Fixed Fee Amount</label>
          <input type="text" value={fixedFeeAmount} onChange={(e) => setFixedFeeAmount(e.target.value)} placeholder="e.g. 500.00" required className={inputClass} />
        </div>
      )}

      {commissionType === 'tiered' && (
        <div>
          <label className={labelClass}>Tiers (contiguous — each tier must start where the previous one ends)</label>
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={tier.minAmount} onChange={(e) => updateTier(i, { minAmount: e.target.value })} placeholder="Min amount" required className={`${inputClass} w-28`} />
                <span className="text-xs text-[#707975]">to</span>
                <input type="text" value={tier.maxAmount ?? ''} onChange={(e) => updateTier(i, { maxAmount: e.target.value || null })} placeholder="Max (blank = unbounded)" className={`${inputClass} w-32`} />
                <input type="text" value={tier.tierPercentage} onChange={(e) => updateTier(i, { tierPercentage: e.target.value })} placeholder="Rate %" required className={`${inputClass} w-24`} />
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(i)} className="text-xs text-red-700 px-2">Remove</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addTier} className="mt-2 text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors">
            Add Tier
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Minimum Fee (optional)</label>
          <input type="text" value={minimumFee} onChange={(e) => setMinimumFee(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Maximum Fee (optional)</label>
          <input type="text" value={maximumFee} onChange={(e) => setMaximumFee(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Settlement Fee</label>
          <input type="text" value={settlementFee} onChange={(e) => setSettlementFee(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Monthly Technology Fee</label>
          <input type="text" value={monthlyTechnologyFee} onChange={(e) => setMonthlyTechnologyFee(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Effective Date</label>
          <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expiry Date (optional)</label>
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Merchant (blank = applies to all merchants)</label>
          <select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={inputClass}>
            <option value="">All merchants (default)</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.business_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Service (blank = applies to all services)</label>
          <select value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} className={inputClass}>
            <option value="">All services (default)</option>
            {SERVICE_CATALOG.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Contract Reference (optional)</label>
        <select value={contractId} onChange={(e) => setContractId(e.target.value)} className={inputClass}>
          <option value="">None</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>{c.contract_number} — {c.contract_title}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#3f4945]">
        <input type="checkbox" checked={allowOverlap} onChange={(e) => setAllowOverlap(e.target.checked)} />
        Allow this rule to overlap with another active rule for the same merchant/service
      </label>

      <div>
        <label className={labelClass}>Reason for This Rate</label>
        <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} required rows={3} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}

      <button type="submit" disabled={pending} className="text-sm font-medium text-white bg-[#00342b] px-5 py-2.5 hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {pending ? 'Saving…' : 'Save Draft'}
      </button>
    </form>
  );
}
