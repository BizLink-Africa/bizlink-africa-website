import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateFollowUpForm from '@/components/admin/crm/CreateFollowUpForm';
import FollowUpCompleteControl from '@/components/admin/crm/FollowUpCompleteControl';
import { labelFor, COMMUNICATION_TYPES, FOLLOW_UP_STATUSES } from '@/data/crm';

export const dynamic = 'force-dynamic';

export default async function FollowUpsPage() {
  let canManage = true;
  try {
    await requirePermission('crm.followups.view');
  } catch {
    return <AccessDenied requiredPermission="crm.followups.view" />;
  }
  try {
    await requirePermission('crm.followups.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: followUps, error }, { data: staffRows }, { data: leadRows }, { data: clientRows }] = await Promise.all([
    supabase
      .from('crm_follow_ups')
      .select('*, website_leads(business_name), clients(business_name)')
      .order('follow_up_date', { ascending: true }),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('website_leads').select('id, business_name').order('business_name'),
    supabase.from('clients').select('id, business_name').order('business_name'),
  ]);

  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Follow-ups</h1>
          <p className="text-sm text-[#707975] mt-1">{followUps?.length ?? 0} follow-up{(followUps?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {canManage && (
          <CreateFollowUpForm
            staff={staffRows ?? []}
            leads={(leadRows ?? []).map((l) => ({ id: l.id, label: l.business_name }))}
            clients={(clientRows ?? []).map((c) => ({ id: c.id, label: c.business_name }))}
          />
        )}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load follow-ups: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Lead / Client</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Assigned To</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(followUps ?? []).map((f) => {
              const overdue = f.status === 'scheduled' && f.follow_up_date < today;
              const name = f.clients?.business_name ?? f.website_leads?.business_name ?? '—';
              return (
                <tr key={f.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className={`px-4 py-3 ${overdue ? 'text-red-700 font-medium' : 'text-[#3f4945]'}`}>
                    {f.follow_up_date} {overdue && '(Overdue)'}
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{name}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{labelFor(COMMUNICATION_TYPES, f.communication_type)}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{f.assigned_user_id ? staffNameById.get(f.assigned_user_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{labelFor(FOLLOW_UP_STATUSES, f.status)}</td>
                  <td className="px-4 py-3">{canManage && <FollowUpCompleteControl id={f.id} status={f.status} />}</td>
                </tr>
              );
            })}
            {(followUps ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No follow-ups yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
