import { formatMoney } from '@/lib/collections/money';
import { SETTLEMENT_BATCH_STATUS_COLORS, SETTLEMENT_BATCH_STATUSES, type SettlementBatch } from '@/data/settlement';
import { labelFor } from '@/data/inquiries';

export default function BatchSummary({ batch }: { batch: SettlementBatch }) {
  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-[#00342b]">{batch.batch_number}</h2>
          <p className="text-xs text-[#707975] mt-0.5">Settlement date {batch.settlement_date}</p>
        </div>
        <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${SETTLEMENT_BATCH_STATUS_COLORS[batch.status] ?? ''}`}>
          {labelFor(SETTLEMENT_BATCH_STATUSES, batch.status)}
        </span>
      </div>

      {batch.compliance_hold && (
        <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">On Compliance Hold</p>
          <p className="text-xs mt-0.5">{batch.compliance_hold_reason} — placed by {batch.compliance_hold_by}</p>
        </div>
      )}

      {batch.requires_dual_approval && (
        <div className="bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
          High-value batch — requires two independent approvals.
          {batch.approved_by && !batch.second_approved_by && ' First approval recorded; awaiting a second, distinct approver.'}
        </div>
      )}

      <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <Field label="Merchants" value={String(batch.merchant_count)} />
        <Field label="Transactions" value={String(batch.transaction_count)} />
        <Field label="Gross Collection" value={formatMoney(batch.gross_collection_total, 'TZS')} />
        <Field label="Provider Fees" value={formatMoney(batch.provider_fee_total, 'TZS')} />
        <Field label="BizLink Commission" value={formatMoney(batch.bizlink_commission_total, 'TZS')} />
        <Field label="Adjustments" value={formatMoney(batch.adjustment_total, 'TZS')} />
        <Field label="Chargeback Holds" value={formatMoney(batch.chargeback_hold_total, 'TZS')} />
        <Field label="Merchant Net Total" value={formatMoney(batch.merchant_net_total, 'TZS')} bold />
        <Field label="Received (Vendor Account)" value={batch.received_vendor_account_amount ? formatMoney(batch.received_vendor_account_amount, 'TZS') : '—'} />
        <Field label="Unresolved Variance" value={formatMoney(batch.unresolved_variance, 'TZS')} bold={batch.unresolved_variance !== '0.00'} />
      </dl>

      {batch.variance_resolution_notes && (
        <div className="border-t border-[#efeded] pt-4 text-xs text-[#707975]">
          <p className="font-semibold uppercase tracking-wider mb-1">Variance Resolution</p>
          <p>{batch.variance_resolution_notes} — authorised by {batch.variance_authorised_by}</p>
        </div>
      )}

      <div className="border-t border-[#efeded] pt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-[#707975]">
        {batch.prepared_by && <Field label="Prepared By" value={batch.prepared_by} small />}
        {batch.reviewed_by && <Field label="Reviewed By" value={batch.reviewed_by} small />}
        {batch.approved_by && <Field label="Approved By" value={batch.approved_by} small />}
        {batch.second_approved_by && <Field label="Second Approver" value={batch.second_approved_by} small />}
        {batch.rejected_by && <Field label="Rejected By" value={batch.rejected_by} small />}
        {batch.cancelled_by && <Field label="Cancelled By" value={batch.cancelled_by} small />}
      </div>
      {batch.rejection_reason && <p className="text-xs text-red-700 italic">Rejection reason: &quot;{batch.rejection_reason}&quot;</p>}
      {batch.cancellation_reason && <p className="text-xs text-red-700 italic">Cancellation reason: &quot;{batch.cancellation_reason}&quot;</p>}
    </div>
  );
}

function Field({ label, value, bold, small }: { label: string; value: string; bold?: boolean; small?: boolean }) {
  return (
    <div>
      <dt className={`font-semibold text-[#707975] uppercase tracking-wider ${small ? 'text-[10px]' : 'text-xs'} mb-0.5`}>{label}</dt>
      <dd className={bold ? 'font-semibold text-[#00342b]' : small ? 'text-[#3f4945]' : 'text-[#1b1c1c]'}>{value}</dd>
    </div>
  );
}
