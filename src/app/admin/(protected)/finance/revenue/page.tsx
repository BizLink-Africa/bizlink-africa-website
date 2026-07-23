import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { FEE_FIELDS, formatMoney, type FeeFieldKey } from '@/data/finance';

export const dynamic = 'force-dynamic';

const RECOGNIZED_STATUSES = ['issued', 'partially_paid', 'paid', 'overdue'];

export default async function RevenueManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  try {
    await requirePermission('finance.reports.view');
  } catch {
    return <AccessDenied requiredPermission="finance.reports.view" />;
  }

  const { from, to } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('invoices')
    .select('client_business_name, currency, issue_date, ' + FEE_FIELDS.map((f) => f.key).join(', '))
    .in('status', RECOGNIZED_STATUSES);
  if (from) query = query.gte('issue_date', from);
  if (to) query = query.lte('issue_date', to);

  const { data: invoices, error } = await query;
  const rows = (invoices ?? []) as unknown as (Record<FeeFieldKey, number> & { client_business_name: string; currency: string })[];

  const currency = rows[0]?.currency ?? 'TZS';
  const categoryTotals = FEE_FIELDS.map((field) => ({
    ...field,
    total: rows.reduce((sum, r) => sum + (r[field.key] ?? 0), 0),
  }));
  const grandTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);

  const byClient = new Map<string, number>();
  for (const r of rows) {
    const rowTotal = FEE_FIELDS.reduce((sum, f) => sum + (r[f.key] ?? 0), 0);
    byClient.set(r.client_business_name, (byClient.get(r.client_business_name) ?? 0) + rowTotal);
  }
  const clientRows = Array.from(byClient.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Revenue Management</h1>
        <p className="text-sm text-[#707975] mt-1">
          Recognized revenue (issued, partially paid, paid, and overdue invoices) by category and client
          {from || to ? ` — ${from ?? 'start'} to ${to ?? 'now'}` : ''}.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 bg-white border border-[#bfc9c4] p-4">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="from">From</label>
          <input id="from" name="from" type="date" defaultValue={from} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="to">To</label>
          <input id="to" name="to" type="date" defaultValue={to} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <button type="submit" className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">Filter</button>
      </form>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load revenue data: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Revenue by Category</h2>
        <table className="w-full text-sm">
          <tbody>
            {categoryTotals.map((c) => (
              <tr key={c.key} className="border-b border-[#e5e5e5] last:border-0">
                <td className="py-2 text-[#707975]">{c.label}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(c.total, currency)}</td>
                <td className="py-2 pl-4 text-right tabular-nums text-xs text-[#707975] w-16">
                  {grandTotal > 0 ? `${Math.round((c.total / grandTotal) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
            <tr className="border-t border-[#bfc9c4]">
              <td className="py-2 font-semibold text-[#00342b]">Total</td>
              <td className="py-2 text-right font-semibold text-[#00342b] tabular-nums">{formatMoney(grandTotal, currency)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Top Clients by Revenue</h2>
        {clientRows.length === 0 ? (
          <p className="text-sm text-[#707975]">No recognized revenue in this range.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {clientRows.map(([client, total]) => (
                <tr key={client} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 text-[#3f4945]">{client}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
