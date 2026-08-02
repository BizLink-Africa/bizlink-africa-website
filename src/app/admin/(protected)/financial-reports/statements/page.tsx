import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import StatementSummary from '@/components/admin/statements/StatementSummary';
import type { MerchantStatement } from '@/data/statements';

export const dynamic = 'force-dynamic';

interface SearchParams {
  merchant?: string;
  from?: string;
  to?: string;
}

function defaultPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export default async function MerchantStatementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const { from: defaultFrom, to: defaultTo } = defaultPeriod();
  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');

  let statement: MerchantStatement | null = null;
  let error: string | null = null;

  if (params.merchant && params.from && params.to) {
    const { data, error: rpcError } = await supabase.rpc('generate_merchant_statement', {
      p_merchant_id: params.merchant,
      p_period_start: params.from,
      p_period_end: params.to,
    });
    if (rpcError) error = rpcError.message;
    else statement = data as MerchantStatement;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
        <h1 className="font-bold text-2xl text-[#00342b] mt-3">Merchant Statements</h1>
        <p className="text-sm text-[#707975] mt-1">Generated entirely server-side. Every export is logged.</p>
      </div>

      <form className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Merchant</label>
          <select name="merchant" defaultValue={params.merchant ?? ''} required className="border border-[#bfc9c4] px-3 py-2 text-sm min-w-[220px] focus:border-[#00342b] focus:outline-none">
            <option value="" disabled>Select a merchant…</option>
            {(merchantRows ?? []).map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">From</label>
          <input type="date" name="from" defaultValue={params.from ?? defaultFrom} required className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">To</label>
          <input type="date" name="to" defaultValue={params.to ?? defaultTo} required className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none" />
        </div>
        <button type="submit" className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">Generate Statement</button>
      </form>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to generate statement: {error}</p>}

      {statement && (
        <div>
          <StatementSummary statement={statement} />
          <div className="mt-4 flex gap-2">
            <a
              href={`/admin/financial-reports/statements/export?merchant=${params.merchant}&from=${params.from}&to=${params.to}&format=csv`}
              className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
            >
              Export CSV
            </a>
            <a
              href={`/admin/financial-reports/statements/export?merchant=${params.merchant}&from=${params.from}&to=${params.to}&format=pdf`}
              className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
            >
              Export PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
