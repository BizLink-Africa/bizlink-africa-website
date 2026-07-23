import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import FinanceStatusBadge from '@/components/admin/finance/FinanceStatusBadge';
import CreateInvoiceForm from '@/components/admin/finance/CreateInvoiceForm';
import { INVOICE_STATUSES, formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  let hasCreatePermission = true;
  try {
    await requirePermission('invoices.view');
  } catch {
    return <AccessDenied requiredPermission="invoices.view" />;
  }
  try {
    await requirePermission('invoices.create');
  } catch {
    hasCreatePermission = false;
  }

  const supabase = await createClient();
  const [{ data: invoices, error }, { data: settings }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, client_business_name, currency, total, outstanding_balance, status, due_date, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('company_settings').select('default_currency, vat_percentage, default_payment_terms_days').eq('id', true).single(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Invoices</h1>
          <p className="text-sm text-[#707975] mt-1">{invoices?.length ?? 0} invoice{(invoices?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {hasCreatePermission && (
          <CreateInvoiceForm
            defaults={{
              currency: settings?.default_currency ?? 'TZS',
              taxPercentage: settings?.vat_percentage ?? 18,
              paymentTermsDays: settings?.default_payment_terms_days ?? 14,
            }}
          />
        )}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load invoices: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Outstanding</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).map((inv) => {
              const isOverdue = inv.due_date && inv.due_date < today && inv.outstanding_balance > 0;
              return (
                <tr key={inv.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#00342b]">
                    <Link href={`/admin/finance/invoices/${inv.id}`} className="hover:underline">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{inv.client_business_name}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{formatMoney(inv.total, inv.currency)}</td>
                  <td className={`px-4 py-3 tabular-nums ${inv.outstanding_balance > 0 ? 'text-[#8a1f1f] font-medium' : 'text-[#3f4945]'}`}>
                    {formatMoney(inv.outstanding_balance, inv.currency)}
                  </td>
                  <td className={`px-4 py-3 ${isOverdue ? 'text-red-700 font-medium' : 'text-[#3f4945]'}`}>
                    {inv.due_date ?? '—'} {isOverdue && '(overdue)'}
                  </td>
                  <td className="px-4 py-3"><FinanceStatusBadge status={inv.status} list={INVOICE_STATUSES} /></td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/finance/invoices/${inv.id}`}
                      className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(invoices ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
