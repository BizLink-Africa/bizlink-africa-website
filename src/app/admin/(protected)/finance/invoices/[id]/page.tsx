import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import FinanceStatusBadge from '@/components/admin/finance/FinanceStatusBadge';
import InvoiceActionButtons from '@/components/admin/finance/InvoiceActionButtons';
import RecordPaymentForm from '@/components/admin/finance/RecordPaymentForm';
import LineItemsEditor from '@/components/admin/finance/LineItemsEditor';
import { updateInvoiceLineItems } from '../actions';
import { INVOICE_STATUSES, FEE_FIELDS, formatMoney, type Invoice, type InvoicePayment, type LineItem } from '@/data/finance';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  performed_by: string;
  action_type: string;
  created_at: string;
}

const EDITABLE_LINE_ITEM_STATUSES = new Set(['draft', 'pending_approval']);

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('invoices.view');
  } catch {
    return <AccessDenied requiredPermission="invoices.view" />;
  }
  let canRecordPayment = true;
  try {
    await requirePermission('invoices.record_payment');
  } catch {
    canRecordPayment = false;
  }
  let canUpdate = true;
  try {
    await requirePermission('invoices.update');
  } catch {
    canUpdate = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: invoice, error }, { data: payments }, { data: activity }, { data: lineItems }] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).single(),
    supabase.from('invoice_payments').select('*').eq('invoice_id', id).order('payment_date', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('id, performed_by, action_type, created_at')
      .eq('module', 'invoices')
      .eq('record_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('created_at', { ascending: true }),
  ]);

  if (error || !invoice) notFound();
  const inv = invoice as Invoice;
  const paymentRows = (payments ?? []) as InvoicePayment[];
  const activityRows = (activity ?? []) as AuditRow[];
  const lineItemRows = (lineItems ?? []) as LineItem[];
  const canEditLineItems = canUpdate && EDITABLE_LINE_ITEM_STATUSES.has(inv.status);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/finance/invoices" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to Invoices
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{inv.invoice_number}</h1>
          <p className="text-sm text-[#707975] mt-1">{inv.client_business_name}</p>
        </div>
        <FinanceStatusBadge status={inv.status} list={INVOICE_STATUSES} />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Actions</h2>
        <InvoiceActionButtons id={inv.id} status={inv.status} />
        {inv.proforma_id && (
          <p className="text-sm text-[#707975] mt-3">
            Converted from{' '}
            <Link href={`/admin/finance/proformas/${inv.proforma_id}`} className="text-[#00342b] hover:underline">
              proforma invoice
            </Link>
          </p>
        )}
      </div>

      {(inv.status === 'issued' || inv.status === 'partially_paid') && canRecordPayment && (
        <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
          <h2 className="font-semibold text-[#00342b] mb-4">Record Payment</h2>
          <RecordPaymentForm invoiceId={inv.id} outstandingBalance={inv.outstanding_balance} currency={inv.currency} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Client</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Business</dt><dd className="text-[#1b1c1c]">{inv.client_business_name}</dd></div>
            <div><dt className="text-xs text-[#707975]">Email</dt><dd className="text-[#1b1c1c]">{inv.client_email ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Phone</dt><dd className="text-[#1b1c1c]">{inv.client_phone ?? '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Details</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Issue Date</dt><dd className="text-[#1b1c1c]">{inv.issue_date ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Due Date</dt><dd className="text-[#1b1c1c]">{inv.due_date ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Created By</dt><dd className="text-[#1b1c1c]">{inv.created_by ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Issued By</dt><dd className="text-[#1b1c1c]">{inv.issued_by ?? '—'}</dd></div>
          </dl>
        </div>
      </div>

      <div className="mb-6">
        <LineItemsEditor
          initialItems={lineItemRows}
          currency={inv.currency}
          readOnly={!canEditLineItems}
          onSave={updateInvoiceLineItems.bind(null, id)}
        />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Fees</h2>
        <table className="w-full text-sm">
          <tbody>
            {FEE_FIELDS.map((field) => (
              <tr key={field.key} className="border-b border-[#e5e5e5] last:border-0">
                <td className="py-2 text-[#707975]">{field.label}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(inv[field.key], inv.currency)}</td>
              </tr>
            ))}
            <tr className="border-t border-[#bfc9c4]">
              <td className="py-2 text-[#707975]">Subtotal</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(inv.subtotal, inv.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-[#707975]">Discount</td>
              <td className="py-2 text-right tabular-nums">-{formatMoney(inv.discount, inv.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-[#707975]">Tax ({inv.tax_percentage}%)</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(inv.tax_amount, inv.currency)}</td>
            </tr>
            <tr className="border-t border-[#bfc9c4]">
              <td className="py-2 font-semibold text-[#00342b]">Total</td>
              <td className="py-2 text-right font-semibold text-[#00342b] tabular-nums">{formatMoney(inv.total, inv.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-[#1b7a3d]">Amount Paid</td>
              <td className="py-2 text-right text-[#1b7a3d] tabular-nums">{formatMoney(inv.amount_paid, inv.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-[#8a1f1f] font-medium">Outstanding Balance</td>
              <td className="py-2 text-right text-[#8a1f1f] font-medium tabular-nums">{formatMoney(inv.outstanding_balance, inv.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Payment History</h2>
        {paymentRows.length === 0 ? (
          <p className="text-sm text-[#707975]">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Date</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Method</th>
                <th className="py-2">Reference</th>
                <th className="py-2">Receipt Ref.</th>
                <th className="py-2">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((payment) => (
                <tr key={payment.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 text-[#3f4945]">{payment.payment_date}</td>
                  <td className="py-2 text-[#1b7a3d] font-medium tabular-nums">{formatMoney(payment.amount, payment.currency ?? inv.currency)}</td>
                  <td className="py-2 text-[#3f4945]">{payment.payment_method ?? '—'}</td>
                  <td className="py-2 text-[#3f4945]">{payment.reference ?? '—'}</td>
                  <td className="py-2 text-[#3f4945]">{payment.receipt_reference ?? '—'}</td>
                  <td className="py-2 text-[#3f4945]">{payment.recorded_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Activity History</h2>
        {activityRows.length === 0 ? (
          <p className="text-sm text-[#707975]">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activityRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between text-[#3f4945]">
                <span className="capitalize">{row.action_type.replace(/_/g, ' ')} by {row.performed_by}</span>
                <span className="text-xs text-[#707975]">{new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
