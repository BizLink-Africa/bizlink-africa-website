'use client';

import { useState } from 'react';
import { previewCommissionCalculation, type CalculationPreviewResult } from '@/app/admin/(protected)/commission-rules/actions';
import { SERVICE_CATALOG } from '@/data/services';
import { formatMoney } from '@/lib/collections/money';

const inputClass = 'border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

export default function CalculationPreviewForm({ merchants }: { merchants: { id: string; business_name: string }[] }) {
  const [merchantId, setMerchantId] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<CalculationPreviewResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await previewCommissionCalculation(merchantId || null, serviceKey || null, grossAmount, asOfDate);
    setOutcome(result);
    setPending(false);
  }

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Merchant</label>
            <select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={inputClass}>
              <option value="">Default (no merchant-specific rule)</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>{m.business_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Service</label>
            <select value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} className={inputClass}>
              <option value="">Default (no service-specific rule)</option>
              {SERVICE_CATALOG.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Transaction Amount</label>
            <input type="text" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} placeholder="e.g. 100000.00" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>As of Date</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} required className={inputClass} />
          </div>
        </div>
        <button type="submit" disabled={pending} className="text-sm font-medium text-white bg-[#00342b] px-5 py-2.5 hover:bg-[#004d40] transition-colors disabled:opacity-60">
          {pending ? 'Calculating…' : 'Preview Calculation'}
        </button>
      </form>

      {outcome && !outcome.success && (
        <p className="mt-5 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{outcome.message}</p>
      )}

      {outcome?.success && outcome.result && (
        <div className="mt-5 border-t border-[#efeded] pt-5">
          <p className="text-xs text-[#707975] mb-3">Applied: {outcome.ruleSummary}</p>
          <dl className="text-sm space-y-1.5">
            <Row label="Base Commission" value={formatMoney(outcome.result.baseCommission, 'TZS')} />
            <Row label="Commission After Min/Max Clamp" value={formatMoney(outcome.result.clampedCommission, 'TZS')} note={
              outcome.result.minimumFeeApplied ? 'minimum fee applied' : outcome.result.maximumFeeApplied ? 'maximum fee applied' : undefined
            } />
            <Row label="Settlement Fee" value={formatMoney(outcome.result.settlementFee, 'TZS')} />
            <Row label="Total Transaction Fees" value={formatMoney(outcome.result.totalTransactionFees, 'TZS')} />
            <Row label="Net Amount to Merchant" value={formatMoney(outcome.result.netAmount, 'TZS')} bold />
            <Row label="Monthly Technology Fee (billed separately)" value={formatMoney(outcome.result.monthlyTechnologyFee, 'TZS')} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, note }: { label: string; value: string; bold?: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#707975]">{label}{note && <span className="text-xs italic"> ({note})</span>}</dt>
      <dd className={bold ? 'font-semibold text-[#00342b]' : 'text-[#1b1c1c]'}>{value}</dd>
    </div>
  );
}
