import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { formatMoney } from '@/lib/collections/money';
import { PRE_SETTLEMENT_CHECK_LABELS, type SettlementBatchExclusion } from '@/data/settlement';

export const dynamic = 'force-dynamic';

export default async function SettlementBatchTransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('settlement.view');
  } catch {
    return <AccessDenied requiredPermission="settlement.view" />;
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase.from('settlement_batches').select('id, batch_number').eq('id', id).maybeSingle();
  if (!batch) notFound();

  const [{ data: included }, { data: excluded }, { data: merchantRows }] = await Promise.all([
    supabase.from('collection_transactions').select('*').eq('settlement_batch_id', id).order('collected_at', { ascending: false }),
    supabase.from('settlement_batch_exclusions').select('*').eq('batch_id', id).order('created_at', { ascending: false }),
    supabase.from('merchants').select('id, business_name'),
  ]);
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));
  const exclusions = (excluded ?? []) as SettlementBatchExclusion[];

  return (
    <div>
      <div className="mb-4">
        <Link href={`/admin/settlement/${id}`} className="text-xs font-medium text-[#00342b] hover:underline">← {batch.batch_number}</Link>
      </div>
      <h1 className="font-bold text-2xl text-[#00342b] mb-6">Transaction Breakdown</h1>

      <h2 className="font-semibold text-[#00342b] mb-3">Included ({(included ?? []).length})</h2>
      <div className="bg-white border border-[#bfc9c4] overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Collected</th>
            </tr>
          </thead>
          <tbody>
            {(included ?? []).map((t) => (
              <tr key={t.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{t.provider_transaction_reference}</td>
                <td className="px-4 py-3 text-[#3f4945]">{t.merchant_id ? merchantNameById.get(t.merchant_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{formatMoney(t.gross_amount, t.currency)}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(t.net_merchant_amount, t.currency)}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs whitespace-nowrap">{new Date(t.collected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              </tr>
            ))}
            {(included ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#707975]">No transactions included.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold text-[#00342b] mb-3">Excluded ({exclusions.length}) — nothing is silently dropped</h2>
      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3">Failed Checks</th>
            </tr>
          </thead>
          <tbody>
            {exclusions.map((e) => (
              <tr key={e.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#3f4945]">{e.merchant_id ? merchantNameById.get(e.merchant_id) ?? e.merchant_id : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{e.transaction_id ?? 'All transactions (merchant-level)'}</td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {e.failed_checks.map((c) => (
                      <span key={c} className="inline-block px-2 py-0.5 bg-red-50 text-red-700 rounded-full">{PRE_SETTLEMENT_CHECK_LABELS[c] ?? c}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {exclusions.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#707975]">No exclusions — every candidate merchant/transaction passed all pre-settlement checks.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
