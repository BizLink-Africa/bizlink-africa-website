import Link from 'next/link';
import { requirePermission, verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import type { Policy } from '@/data/governance';
import AcknowledgePolicyButton from '@/components/admin/compliance/AcknowledgePolicyButton';

export const dynamic = 'force-dynamic';

export default async function PolicyAcknowledgementsPage() {
  try {
    await requirePermission('policies.view');
  } catch {
    return <AccessDenied requiredPermission="policies.view" />;
  }
  let canAcknowledge = true;
  try {
    await requirePermission('policies.acknowledge');
  } catch {
    canAcknowledge = false;
  }

  const user = await verifyAdminSession();
  const supabase = await createClient();

  const [{ data: policies, error }, { data: staffRows }, { data: acknowledgements }] = await Promise.all([
    supabase.from('governance_policies').select('*').eq('acknowledgement_required', true).eq('status', 'active').order('title'),
    supabase.from('staff_profiles').select('id, user_id').eq('is_active', true),
    supabase.from('policy_acknowledgements').select('policy_id, staff_id, acknowledged_at'),
  ]);

  const activePolicies = (policies ?? []) as Policy[];
  const activeStaffIds = new Set((staffRows ?? []).map((s) => s.id));
  const myStaffId = (staffRows ?? []).find((s) => s.user_id === user.id)?.id;
  const acks = acknowledgements ?? [];

  const ackedByPolicy = new Map<string, Set<string>>();
  for (const a of acks) {
    if (!ackedByPolicy.has(a.policy_id)) ackedByPolicy.set(a.policy_id, new Set());
    ackedByPolicy.get(a.policy_id)!.add(a.staff_id);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Policy Acknowledgements</h1>
        <p className="text-sm text-[#707975] mt-1">
          Active policies requiring staff sign-off, and coverage across every active staff member. Policy documents themselves are managed on{' '}
          <Link href="/admin/governance/policies" className="text-[#00342b] hover:underline">Governance → Policies</Link>.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load policies: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Policy</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Coverage</th>
              <th className="px-4 py-3">Your Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {activePolicies.map((p) => {
              const acked = ackedByPolicy.get(p.id) ?? new Set();
              const coverage = `${[...acked].filter((id) => activeStaffIds.has(id)).length}/${activeStaffIds.size}`;
              const iAcked = myStaffId ? acked.has(myStaffId) : false;
              return (
                <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#1b1c1c]">{p.title}</td>
                  <td className="px-4 py-3 text-xs text-[#3f4945] font-mono">{p.version}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{coverage}</td>
                  <td className="px-4 py-3">
                    {iAcked ? (
                      <span className="text-xs font-medium text-[#1b7a3d]">Acknowledged</span>
                    ) : (
                      <span className="text-xs font-medium text-[#8a5a00]">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!iAcked && canAcknowledge && myStaffId && <AcknowledgePolicyButton policyId={p.id} />}
                  </td>
                </tr>
              );
            })}
            {activePolicies.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No active policies require acknowledgement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
