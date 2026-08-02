import { requireActiveMerchant } from '@/lib/supabase/merchant-dal';
import { createClient } from '@/lib/supabase/server';
import StatementSummary from '@/components/admin/statements/StatementSummary';
import type { MerchantStatement } from '@/data/statements';

export const dynamic = 'force-dynamic';

interface SearchParams {
  from?: string;
  to?: string;
}

function defaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

// Self-service — always scoped to the signed-in merchant's own merchant_id,
// never a value read from the client. generate_merchant_statement() itself
// independently enforces the same boundary server-side (see the migration
// comment), so this is defense in depth, not the only guard.
export default async function MerchantStatementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const merchant = await requireActiveMerchant();
  const params = await searchParams;
  const { from: defaultFrom, to: defaultTo } = defaultPeriod();
  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_merchant_statement', {
    p_merchant_id: merchant.merchantId,
    p_period_start: from,
    p_period_end: to,
  });
  const statement = (data ?? null) as MerchantStatement | null;

  return (
    <div className="max-w-2xl mx-auto px-6 md:px-12 py-10">
      <h1 className="font-bold text-xl text-[#00342b] mb-1">Your Statement</h1>
      <p className="text-sm text-[#707975] mb-6">Generated server-side from your settlement ledger.</p>

      <form className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label>
          <input type="date" name="from" defaultValue={from} required className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label>
          <input type="date" name="to" defaultValue={to} required className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <button type="submit" className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">View</button>
      </form>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to generate your statement: {error.message}</p>}

      {statement && (
        <div>
          <StatementSummary statement={statement} />
          <div className="mt-4 flex gap-2">
            <a href={`/merchant/statement/export?from=${from}&to=${to}&format=csv`} className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Export CSV</a>
            <a href={`/merchant/statement/export?from=${from}&to=${to}&format=pdf`} className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Export PDF</a>
          </div>
        </div>
      )}
    </div>
  );
}
