import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ProposalStatusBadge from '@/components/admin/crm/ProposalStatusBadge';
import { formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

export default async function ProposalsPage() {
  let hasManagePermission = true;
  try {
    await requirePermission('proposals.view');
  } catch {
    return <AccessDenied requiredPermission="proposals.view" />;
  }
  try {
    await requirePermission('proposals.manage');
  } catch {
    hasManagePermission = false;
  }

  const supabase = await createClient();
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('id, proposal_number, pricing_summary_total, currency, status, valid_until')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Proposals</h1>
          <p className="text-sm text-[#707975] mt-1">{proposals?.length ?? 0} proposal{(proposals?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {hasManagePermission && (
          <Link href="/admin/crm/proposals/new" className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
            New Proposal
          </Link>
        )}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load proposals: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Valid Until</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(proposals ?? []).map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  <Link href={`/admin/crm/proposals/${p.id}`} className="hover:underline">{p.proposal_number}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{formatMoney(p.pricing_summary_total, p.currency)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.valid_until ?? '—'}</td>
                <td className="px-4 py-3"><ProposalStatusBadge status={p.status} /></td>
                <td className="px-4 py-3">
                  <Link href={`/admin/crm/proposals/${p.id}`} className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(proposals ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">No proposals yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
