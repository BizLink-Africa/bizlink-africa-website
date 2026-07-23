import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import FinanceStatusBadge from '@/components/admin/finance/FinanceStatusBadge';
import ProformaActionButtons from '@/components/admin/finance/ProformaActionButtons';
import LineItemsEditor from '@/components/admin/finance/LineItemsEditor';
import ProformaPrintButton from '@/components/admin/finance/ProformaPrintButton';
import { updateProformaLineItems } from '../actions';
import { PROFORMA_STATUSES, FEE_FIELDS, formatMoney, type ProformaInvoice, type LineItem } from '@/data/finance';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  performed_by: string;
  action_type: string;
  created_at: string;
}

const EDITABLE_LINE_ITEM_STATUSES = new Set(['draft', 'pending_approval']);

export default async function ProformaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('proformas.view');
  } catch {
    return <AccessDenied requiredPermission="proformas.view" />;
  }
  let canUpdate = true;
  try {
    await requirePermission('proformas.update');
  } catch {
    canUpdate = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: proforma, error }, { data: activity }, { data: lineItems }] = await Promise.all([
    supabase.from('proforma_invoices').select('*').eq('id', id).single(),
    supabase
      .from('audit_logs')
      .select('id, performed_by, action_type, created_at')
      .eq('module', 'proforma_invoices')
      .eq('record_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('proforma_line_items').select('*').eq('proforma_id', id).order('created_at', { ascending: true }),
  ]);

  if (error || !proforma) notFound();
  const p = proforma as ProformaInvoice;
  const activityRows = (activity ?? []) as AuditRow[];
  const lineItemRows = (lineItems ?? []) as LineItem[];
  const canEditLineItems = canUpdate && EDITABLE_LINE_ITEM_STATUSES.has(p.status);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/finance/proformas" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-4 print:hidden">
        <ArrowLeft size={14} /> Back to Proforma Invoices
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{p.proforma_number}</h1>
          <p className="text-sm text-[#707975] mt-1">{p.client_business_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <FinanceStatusBadge status={p.status} list={PROFORMA_STATUSES} />
          <ProformaPrintButton proformaId={p.id} />
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6 print:hidden">
        <h2 className="font-semibold text-[#00342b] mb-4">Actions</h2>
        <ProformaActionButtons id={p.id} status={p.status} alreadyConverted={Boolean(p.converted_invoice_id)} />
        {p.converted_invoice_id && (
          <p className="text-sm text-[#707975] mt-3">
            Converted to invoice —{' '}
            <Link href={`/admin/finance/invoices/${p.converted_invoice_id}`} className="text-[#00342b] hover:underline">
              view invoice
            </Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Client</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Business</dt><dd className="text-[#1b1c1c]">{p.client_business_name}</dd></div>
            <div><dt className="text-xs text-[#707975]">Email</dt><dd className="text-[#1b1c1c]">{p.client_email ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Phone</dt><dd className="text-[#1b1c1c]">{p.client_phone ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Address</dt><dd className="text-[#1b1c1c]">{p.client_address ?? '—'}</dd></div>
          </dl>
        </div>

        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Details</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Service</dt><dd className="text-[#1b1c1c]">{p.service_summary ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Valid Until</dt><dd className="text-[#1b1c1c]">{p.valid_until ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Payment Terms</dt><dd className="text-[#1b1c1c]">{p.payment_terms ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Created By</dt><dd className="text-[#1b1c1c]">{p.created_by ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Approved By</dt><dd className="text-[#1b1c1c]">{p.approved_by ?? '—'}</dd></div>
          </dl>
        </div>
      </div>

      <div className="mb-6">
        <LineItemsEditor
          initialItems={lineItemRows}
          currency={p.currency}
          readOnly={!canEditLineItems}
          onSave={updateProformaLineItems.bind(null, id)}
        />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Fees</h2>
        <table className="w-full text-sm">
          <tbody>
            {FEE_FIELDS.map((field) => (
              <tr key={field.key} className="border-b border-[#e5e5e5] last:border-0">
                <td className="py-2 text-[#707975]">{field.label}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(p[field.key], p.currency)}</td>
              </tr>
            ))}
            <tr className="border-t border-[#bfc9c4]">
              <td className="py-2 text-[#707975]">Subtotal</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(p.subtotal, p.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-[#707975]">Discount</td>
              <td className="py-2 text-right tabular-nums">-{formatMoney(p.discount, p.currency)}</td>
            </tr>
            <tr>
              <td className="py-2 text-[#707975]">Tax ({p.tax_percentage}%)</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(p.tax_amount, p.currency)}</td>
            </tr>
            <tr className="border-t border-[#bfc9c4]">
              <td className="py-2 font-semibold text-[#00342b]">Total</td>
              <td className="py-2 text-right font-semibold text-[#00342b] tabular-nums">{formatMoney(p.total, p.currency)}</td>
            </tr>
          </tbody>
        </table>
        {(p.notes || p.terms_and_conditions) && (
          <div className="mt-4 pt-4 border-t border-[#e5e5e5] space-y-3 text-sm">
            {p.notes && <div><p className="text-xs text-[#707975] mb-1">Notes</p><p className="text-[#1b1c1c]">{p.notes}</p></div>}
            {p.terms_and_conditions && <div><p className="text-xs text-[#707975] mb-1">Terms &amp; Conditions</p><p className="text-[#1b1c1c]">{p.terms_and_conditions}</p></div>}
          </div>
        )}
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 print:hidden">
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
