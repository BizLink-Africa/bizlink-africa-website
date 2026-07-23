import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import InlineSelect from '@/components/admin/InlineSelect';
import PolicyStatusBadge from '@/components/admin/governance/PolicyStatusBadge';
import CreatePolicyForm from '@/components/admin/governance/CreatePolicyForm';
import { POLICY_STATUSES, POLICY_CATEGORIES, labelFor } from '@/data/governance';
import { updatePolicyStatus } from './actions';

export const dynamic = 'force-dynamic';

export default async function GovernancePoliciesPage() {
  let hasManagePermission = true;
  try {
    await requirePermission('policies.view');
  } catch {
    return <AccessDenied requiredPermission="policies.view" />;
  }
  try {
    await requirePermission('policies.manage');
  } catch {
    hasManagePermission = false;
  }

  const supabase = await createClient();
  const { data: policies, error } = await supabase.from('governance_policies').select('*').order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Policies</h1>
          <p className="text-sm text-[#707975] mt-1">{policies?.length ?? 0} policy document{(policies?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {hasManagePermission && <CreatePolicyForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load policy documents: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Review Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Ack. Required</th>
            </tr>
          </thead>
          <tbody>
            {(policies ?? []).map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">{p.title}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(POLICY_CATEGORIES, p.category)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.version}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.owner ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.review_date ?? '—'}</td>
                <td className="px-4 py-3">
                  {hasManagePermission ? (
                    <InlineSelect value={p.status} options={POLICY_STATUSES} onSave={updatePolicyStatus.bind(null, p.id)} />
                  ) : (
                    <PolicyStatusBadge status={p.status} list={POLICY_STATUSES} />
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {p.file_url ? (
                    <a href={p.file_url} target="_blank" rel="noreferrer" className="text-[#00342b] hover:underline">View</a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{p.acknowledgement_required ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {(policies ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No policy documents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
