import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

interface PaymentRow {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string | null;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  receipt_reference: string | null;
  recorded_by: string | null;
  notes: string | null;
  invoices: { invoice_number: string; client_business_name: string } | null;
}

export default async function PaymentsReceivedPage() {
  try {
    await requirePermission('payments.view');
  } catch {
    return <AccessDenied requiredPermission="payments.view" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('id, invoice_id, amount, currency, payment_date, payment_method, reference, receipt_reference, recorded_by, notes, invoices(invoice_number, client_business_name)')
    .order('payment_date', { ascending: false });

  const payments = (data ?? []) as unknown as PaymentRow[];
  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const currency = payments[0]?.currency ?? 'TZS';

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Payments Received</h1>
        <p className="text-sm text-[#707975] mt-1">
          {payments.length} payment{payments.length === 1 ? '' : 's'} — {formatMoney(totalReceived, currency)} total received
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load payments: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Receipt Ref.</th>
              <th className="px-4 py-3">Recorded By</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#3f4945]">{p.payment_date}</td>
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  {p.invoices ? <Link href={`/admin/finance/invoices/${p.invoice_id}`} className="hover:underline">{p.invoices.invoice_number}</Link> : '—'}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{p.invoices?.client_business_name ?? '—'}</td>
                <td className="px-4 py-3 text-[#1b7a3d] font-medium tabular-nums">{formatMoney(p.amount, p.currency ?? currency)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.payment_method ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.reference ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.receipt_reference ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.recorded_by ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.notes ?? '—'}</td>
              </tr>
            ))}
            {payments.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
