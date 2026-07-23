import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney, AGING_BUCKETS, daysOverdue } from '@/data/finance';

export const dynamic = 'force-dynamic';

interface ReceivableRow {
  id: string;
  invoice_number: string;
  client_business_name: string;
  currency: string;
  outstanding_balance: number;
  due_date: string | null;
}

export default async function ReceivablesPage() {
  try {
    await requirePermission('invoices.view');
  } catch {
    return <AccessDenied requiredPermission="invoices.view" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, client_business_name, currency, outstanding_balance, due_date')
    .in('status', ['issued', 'partially_paid', 'overdue'])
    .gt('outstanding_balance', 0)
    .order('due_date', { ascending: true });

  const receivables = (data ?? []) as ReceivableRow[];
  const today = new Date().toISOString().slice(0, 10);
  const totalOutstanding = receivables.reduce((sum, r) => sum + r.outstanding_balance, 0);
  const currency = receivables[0]?.currency ?? 'TZS';

  const bucketed = AGING_BUCKETS.map((bucket) => {
    const rows = receivables.filter((r) => bucket.test(daysOverdue(r.due_date, today)));
    return { ...bucket, rows, total: rows.reduce((sum, r) => sum + r.outstanding_balance, 0) };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Receivables Aging</h1>
        <p className="text-sm text-[#707975] mt-1">
          {receivables.length} outstanding invoice{receivables.length === 1 ? '' : 's'} — {formatMoney(totalOutstanding, currency)} total
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load receivables: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {bucketed.map((bucket) => (
          <div key={bucket.key} className={`bg-white border p-4 ${bucket.key !== 'current' && bucket.total > 0 ? 'border-red-200' : 'border-[#bfc9c4]'}`}>
            <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider">{bucket.label}</p>
            <p className={`mt-1 font-bold text-xl ${bucket.key !== 'current' && bucket.total > 0 ? 'text-red-700' : 'text-[#00342b]'}`}>
              {formatMoney(bucket.total, currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Outstanding</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Days Overdue</th>
            </tr>
          </thead>
          <tbody>
            {receivables.map((r) => {
              const days = daysOverdue(r.due_date, today);
              return (
                <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#00342b]">
                    <Link href={`/admin/finance/invoices/${r.id}`} className="hover:underline">{r.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.client_business_name}</td>
                  <td className="px-4 py-3 text-[#8a1f1f] font-medium tabular-nums">{formatMoney(r.outstanding_balance, r.currency)}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.due_date ?? '—'}</td>
                  <td className={`px-4 py-3 tabular-nums ${days > 0 ? 'text-red-700 font-medium' : 'text-[#3f4945]'}`}>{days > 0 ? days : '—'}</td>
                </tr>
              );
            })}
            {receivables.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No outstanding receivables.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
