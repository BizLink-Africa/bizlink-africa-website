import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import Pill from '@/components/admin/operations/Pill';
import { PROVISIONING_STATUSES, labelFor, type ProvisioningStatus } from '@/data/operations';

export const dynamic = 'force-dynamic';

const STATUS_TONES: Record<ProvisioningStatus, 'neutral' | 'warning' | 'success'> = {
  not_started: 'neutral',
  in_progress: 'warning',
  completed: 'success',
};

export default async function ClientProvisioningPage() {
  try {
    await requirePermission('provisioning.view');
  } catch {
    return <AccessDenied requiredPermission="provisioning.view" />;
  }

  const supabase = await createClient();
  const [{ data: clients, error }, { data: provisioningRows }, { data: staffRows }] = await Promise.all([
    supabase.from('clients').select('id, business_name').eq('is_active', true).order('business_name'),
    supabase.from('client_provisioning').select('client_id, technical_owner, activation_date, training_status, handover_status'),
    supabase.from('staff_profiles').select('id, full_name'),
  ]);

  const provisioningByClient = new Map((provisioningRows ?? []).map((p) => [p.client_id, p]));
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Client Provisioning</h1>
        <p className="text-sm text-[#707975] mt-1">Technical activation profile per client — enabled modules, integration credentials, training and handover status.</p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load clients: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Technical Owner</th>
              <th className="px-4 py-3">Activation Date</th>
              <th className="px-4 py-3">Training</th>
              <th className="px-4 py-3">Handover</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => {
              const profile = provisioningByClient.get(c.id);
              return (
                <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#1b1c1c]">{c.business_name}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{profile?.technical_owner ? staffNameById.get(profile.technical_owner) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{profile?.activation_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Pill label={labelFor(PROVISIONING_STATUSES, profile?.training_status ?? 'not_started')} tone={STATUS_TONES[(profile?.training_status as ProvisioningStatus) ?? 'not_started']} />
                  </td>
                  <td className="px-4 py-3">
                    <Pill label={labelFor(PROVISIONING_STATUSES, profile?.handover_status ?? 'not_started')} tone={STATUS_TONES[(profile?.handover_status as ProvisioningStatus) ?? 'not_started']} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/operations/provisioning/${c.id}`}
                      className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                    >
                      {profile ? 'Manage' : 'Set Up'}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(clients ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No active clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
