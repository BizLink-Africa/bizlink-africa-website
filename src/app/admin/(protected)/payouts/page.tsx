import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SandboxBanner from '@/components/admin/payouts/SandboxBanner';
import { formatMoney } from '@/lib/collections/money';
import { MERCHANT_PAYOUT_STATUSES, MERCHANT_PAYOUT_STATUS_COLORS, type MerchantPayout } from '@/data/payouts';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  merchant?: string;
  batch?: string;
}

export default async function MerchantPayoutsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('payouts.view');
  } catch {
    return <AccessDenied requiredPermission="payouts.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();

  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');
  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));

  let query = supabase.from('merchant_payouts').select('*').order('requested_at', { ascending: false }).limit(200);
  if (params.status) query = query.eq('status', params.status);
  if (params.merchant) query = query.eq('merchant_id', params.merchant);
  if (params.batch) query = query.eq('batch_id', params.batch);
  const { data, error } = await query;
  const payouts = (data ?? []) as MerchantPayout[];

  return (
    <div>
      <div className="mb-3">
        <SandboxBanner />
      </div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Merchant Payouts</h1>
        <p className="text-sm text-[#707975] mt-1">
          Submissions call Selcom&apos;s real sandbox Transaction Process API — signed, real network requests — but can
          never reach Selcom&apos;s production environment. Every submission is backend-only, idempotent, and requires
          re-authentication.
        </p>
      </div>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {MERCHANT_PAYOUT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Merchant</label>
          <select name="merchant" defaultValue={params.merchant ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {(merchantRows ?? []).map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
          </select>
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">
          Filter
        </button>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load payouts: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Retries</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{p.payout_reference}</td>
                <td className="px-4 py-3 text-[#3f4945]">{merchantNameById.get(p.merchant_id) ?? p.merchant_id}</td>
                <td className="px-4 py-3 text-[#1b1c1c] font-medium">{formatMoney(p.amount, p.currency)}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{p.retry_count}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_PAYOUT_STATUS_COLORS[p.status] ?? ''}`}>
                    {labelFor(MERCHANT_PAYOUT_STATUSES, p.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#3f4945] text-xs whitespace-nowrap">{new Date(p.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-4 py-3"><Link href={`/admin/payouts/${p.id}`} className="text-xs font-medium text-[#00342b] hover:underline">View →</Link></td>
              </tr>
            ))}
            {payouts.length === 0 && !error && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">No payouts yet — payouts are created from an approved settlement batch.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
