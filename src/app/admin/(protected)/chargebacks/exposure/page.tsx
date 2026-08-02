import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';

export const dynamic = 'force-dynamic';

interface ExposureRow {
  merchant_id: string;
  business_name: string;
  open_case_count: number;
  disputed_amount_open: string;
  unrecovered_loss: string;
  active_hold_count: number;
  active_hold_amount: string;
}

export default async function MerchantExposureSummaryPage() {
  try {
    await requirePermission('chargebacks.view');
  } catch {
    return <AccessDenied requiredPermission="chargebacks.view" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('merchant_chargeback_exposure')
    .select('*')
    .order('unrecovered_loss', { ascending: false });
  const rows = (data ?? []) as ExposureRow[];

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/chargebacks" className="text-xs font-medium text-[#00342b] hover:underline">← Chargeback Cases</Link>
        <h1 className="font-bold text-2xl text-[#00342b] mt-3">Merchant Exposure Summary</h1>
        <p className="text-sm text-[#707975] mt-1">Every total below is computed in the database — never summed in the browser. Merchants with no open cases or active holds are omitted.</p>
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load exposure summary: {error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Open Cases</th>
              <th className="px-4 py-3">Disputed (Open)</th>
              <th className="px-4 py-3">Unrecovered Loss</th>
              <th className="px-4 py-3">Active Holds</th>
              <th className="px-4 py-3">Held Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.merchant_id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{r.business_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.open_case_count}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(r.disputed_amount_open, 'TZS')}</td>
                <td className="px-4 py-3 text-[#8a1f1f] font-medium">{formatMoney(r.unrecovered_loss, 'TZS')}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.active_hold_count}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(r.active_hold_amount, 'TZS')}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No merchants currently have open exposure.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
