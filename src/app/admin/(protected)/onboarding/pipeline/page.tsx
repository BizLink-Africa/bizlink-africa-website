import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import Pill, { PRIORITY_TONES } from '@/components/admin/operations/Pill';
import CreateOnboardingCaseForm from '@/components/admin/operations/CreateOnboardingCaseForm';
import { ONBOARDING_STAGES, CLOSED_ONBOARDING_STAGES, labelFor, type OnboardingStage } from '@/data/operations';

export const dynamic = 'force-dynamic';

interface CaseRow {
  id: string;
  case_number: string;
  stage: OnboardingStage;
  priority: string;
  due_date: string | null;
  assigned_user_id: string | null;
  clients: { business_name: string } | null;
  website_leads: { business_name: string } | null;
}

export default async function OnboardingPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  let hasManagePermission = true;
  try {
    await requirePermission('onboarding.view');
  } catch {
    return <AccessDenied requiredPermission="onboarding.view" />;
  }
  try {
    await requirePermission('onboarding.manage');
  } catch {
    hasManagePermission = false;
  }

  const { view = 'open' } = await searchParams;
  const supabase = await createClient();

  const [{ data, error }, { data: clients }, { data: leads }, { data: staffRows }] = await Promise.all([
    supabase
      .from('onboarding_cases')
      .select('id, case_number, stage, priority, due_date, assigned_user_id, clients(business_name), website_leads(business_name)')
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, business_name').order('business_name'),
    supabase.from('website_leads').select('id, business_name').order('business_name'),
    supabase.from('staff_profiles').select('id, full_name'),
  ]);

  const rows = (data ?? []) as unknown as CaseRow[];
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  const filtered = rows.filter((row) => {
    if (view === 'open') return !CLOSED_ONBOARDING_STAGES.includes(row.stage);
    if (view === 'closed') return CLOSED_ONBOARDING_STAGES.includes(row.stage);
    return true;
  });

  return (
    <div className="relative">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href="/admin/onboarding" className="text-sm text-[#707975] hover:text-[#00342b]">← Back to Onboarding</Link>
          <h1 className="font-bold text-2xl text-[#00342b] mt-2">Onboarding Pipeline</h1>
          <p className="text-sm text-[#707975] mt-1">{filtered.length} case{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-white border border-[#bfc9c4] p-1">
            {(['open', 'closed', 'all'] as const).map((v) => (
              <Link
                key={v}
                href={`/admin/onboarding/pipeline?view=${v}`}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  view === v ? 'bg-[#00342b] text-white' : 'text-[#3f4945] hover:bg-[#f5f3f3]'
                }`}
              >
                {v}
              </Link>
            ))}
          </div>
          {hasManagePermission && <CreateOnboardingCaseForm clients={clients ?? []} leads={leads ?? []} />}
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load onboarding cases: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Client / Lead</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  <Link href={`/admin/onboarding/pipeline/${row.id}`} className="hover:underline">{row.case_number}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{row.clients?.business_name ?? row.website_leads?.business_name ?? '—'}</td>
                <td className="px-4 py-3"><Pill label={labelFor(ONBOARDING_STAGES, row.stage)} tone="info" /></td>
                <td className="px-4 py-3"><Pill label={row.priority} tone={PRIORITY_TONES[row.priority] ?? 'neutral'} /></td>
                <td className="px-4 py-3 text-[#3f4945]">{row.assigned_user_id ? staffNameById.get(row.assigned_user_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{row.due_date ?? '—'}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/onboarding/pipeline/${row.id}`}
                    className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No onboarding cases in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
