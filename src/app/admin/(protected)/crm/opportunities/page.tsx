import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import OpportunityStageBadge from '@/components/admin/crm/OpportunityStageBadge';
import { formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  let hasManagePermission = true;
  try {
    await requirePermission('opportunities.view');
  } catch {
    return <AccessDenied requiredPermission="opportunities.view" />;
  }
  try {
    await requirePermission('opportunities.manage');
  } catch {
    hasManagePermission = false;
  }

  const supabase = await createClient();
  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('id, opportunity_number, name, estimated_value, currency, probability, stage, expected_close_date')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Opportunities</h1>
          <p className="text-sm text-[#707975] mt-1">{opportunities?.length ?? 0} opportunit{(opportunities?.length ?? 0) === 1 ? 'y' : 'ies'}</p>
        </div>
        {hasManagePermission && (
          <Link href="/admin/crm/opportunities/new" className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
            New Opportunity
          </Link>
        )}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load opportunities: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Probability</th>
              <th className="px-4 py-3">Expected Close</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(opportunities ?? []).map((o) => (
              <tr key={o.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  <Link href={`/admin/crm/opportunities/${o.id}`} className="hover:underline">{o.opportunity_number} — {o.name}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{formatMoney(o.estimated_value, o.currency)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{o.probability}%</td>
                <td className="px-4 py-3 text-[#3f4945]">{o.expected_close_date ?? '—'}</td>
                <td className="px-4 py-3"><OpportunityStageBadge stage={o.stage} /></td>
                <td className="px-4 py-3">
                  <Link href={`/admin/crm/opportunities/${o.id}`} className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(opportunities ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No opportunities yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
