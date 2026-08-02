import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';

export const dynamic = 'force-dynamic';

interface Row { merchant_id: string; business_name: string; unsettled_transaction_count: number; unsettled_net_amount: string }

export default async function OutstandingLiabilitiesReportPage() {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('v_merchant_outstanding_liabilities').select('*').order('unsettled_net_amount', { ascending: false });
  const rows = (data ?? []) as Row[];
  const total = rows.reduce((sum, r) => sum + Number(r.unsettled_net_amount), 0);

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-1">Outstanding Merchant Liabilities</h1>
      <p className="text-sm text-[#707975] mb-6">As of right now — matched transactions with no successful payout yet.</p>

      <div className="mb-4 flex justify-end">
        <a href="/admin/financial-reports/outstanding-liabilities/export" className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">Export CSV</a>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-4 mb-4 max-w-xs">
        <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Total Outstanding</p>
        <p className="text-lg font-bold text-[#8a1f1f]">{formatMoney(total, 'TZS')}</p>
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th><th className="px-4 py-3">Unsettled Transactions</th><th className="px-4 py-3">Unsettled Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.merchant_id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{r.business_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.unsettled_transaction_count}</td>
                <td className="px-4 py-3 text-[#8a1f1f] font-medium">{formatMoney(r.unsettled_net_amount, 'TZS')}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-[#707975]">No outstanding liabilities.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
