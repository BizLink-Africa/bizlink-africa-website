import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { PAYOUT_LINE_STATUSES, type SettlementBatchLine } from '@/data/settlement';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function SettlementBatchMerchantsPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('settlement.view');
  } catch {
    return <AccessDenied requiredPermission="settlement.view" />;
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase.from('settlement_batches').select('id, batch_number').eq('id', id).maybeSingle();
  if (!batch) notFound();

  const [{ data: lines }, { data: merchantRows }] = await Promise.all([
    supabase.from('settlement_batch_lines').select('*').eq('batch_id', id).order('gross_amount', { ascending: false }),
    supabase.from('merchants').select('id, business_name'),
  ]);
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));
  const typedLines = (lines ?? []) as SettlementBatchLine[];

  return (
    <div>
      <div className="mb-4">
        <Link href={`/admin/settlement/${id}`} className="text-xs font-medium text-[#00342b] hover:underline">← {batch.batch_number}</Link>
      </div>
      <h1 className="font-bold text-2xl text-[#00342b] mb-6">Merchant Breakdown</h1>

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Txns</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Fee / Commission</th>
              <th className="px-4 py-3">Adjustments</th>
              <th className="px-4 py-3">Chargeback Hold</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Payout</th>
            </tr>
          </thead>
          <tbody>
            {typedLines.map((l) => (
              <tr key={l.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{merchantNameById.get(l.merchant_id) ?? l.merchant_id}</td>
                <td className="px-4 py-3 text-[#3f4945]">{l.transaction_count}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(l.gross_amount, 'TZS')}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{formatMoney(l.provider_fee, 'TZS')} / {formatMoney(l.bizlink_commission, 'TZS')}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{formatMoney(l.adjustment_total, 'TZS')}</td>
                <td className="px-4 py-3 text-xs">{l.chargeback_hold !== '0.00' ? <span className="text-[#8a5a00]">{formatMoney(l.chargeback_hold, 'TZS')}</span> : '—'}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(l.net_amount, 'TZS')}</td>
                <td className="px-4 py-3 text-xs">
                  {labelFor(PAYOUT_LINE_STATUSES, l.payout_status)}
                  {l.payout_reference && <span className="block text-[#707975]">{l.payout_reference}</span>}
                  {l.payout_failure_reason && <span className="block text-red-700">{l.payout_failure_reason}</span>}
                </td>
              </tr>
            ))}
            {typedLines.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">No merchant lines in this batch.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
