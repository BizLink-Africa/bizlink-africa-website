import { formatMoney } from '@/lib/collections/money';
import type { MerchantStatement } from '@/data/statements';

export default function StatementSummary({ statement }: { statement: MerchantStatement }) {
  return (
    <div className="bg-white border border-[#bfc9c4] p-6 max-w-2xl">
      <div className="mb-4">
        <h2 className="font-semibold text-[#00342b]">{statement.merchantName}</h2>
        <p className="text-xs text-[#707975] mt-0.5">
          Reference {statement.merchantReference ?? '—'} · Till {statement.tillReference ?? '—'}
        </p>
        <p className="text-xs text-[#707975] mt-0.5">
          Period {statement.statementPeriodStart} to {statement.statementPeriodEnd} · {statement.transactionCount} transaction(s)
        </p>
      </div>

      <dl className="text-sm space-y-1.5">
        <Row label="Opening Unsettled Balance" value={formatMoney(statement.openingUnsettledBalance, 'TZS')} />
        <Row label="Gross Collections" value={formatMoney(statement.grossCollections, 'TZS')} />
        <Row label="Provider / Processing Fees" value={`(${formatMoney(statement.providerFees, 'TZS')})`} />
        <Row label="BizLink Commission & Service Fees" value={`(${formatMoney(statement.bizlinkCommission, 'TZS')})`} />
        <Row label="Adjustments" value={formatMoney(statement.adjustments, 'TZS')} />
        <Row label="Reversals" value={`(${formatMoney(statement.reversals, 'TZS')})`} />
        <Row label="Chargebacks (Lost)" value={`(${formatMoney(statement.chargebacks, 'TZS')})`} />
        <div className="border-t border-[#efeded] my-2" />
        <Row label="Net Settlement (this period)" value={formatMoney(statement.netSettlement, 'TZS')} bold />
        <Row label="Paid Out This Period" value={formatMoney(statement.paidThisPeriod, 'TZS')} />
        <Row label="Closing Unsettled Balance" value={formatMoney(statement.closingUnsettledBalance, 'TZS')} bold />
      </dl>

      <div className="border-t border-[#efeded] mt-4 pt-4 text-xs text-[#707975] space-y-1">
        <p>Payout Reference: {statement.payoutReference ?? '—'}</p>
        <p>Settlement Destination: {statement.settlementDestinationMasked ?? '—'}</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#707975]">{label}</dt>
      <dd className={bold ? 'font-semibold text-[#00342b]' : 'text-[#1b1c1c]'}>{value}</dd>
    </div>
  );
}
