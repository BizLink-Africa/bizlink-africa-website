import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ONBOARDING_CHECKLIST_ITEMS, type OnboardingChecklistKey } from '@/data/clients';

export const dynamic = 'force-dynamic';

interface LeadRef {
  id: string;
  full_name: string;
  business_name: string;
  assigned_to: string | null;
}

interface ClientRef {
  id: string;
  client_name: string;
  business_name: string;
  assigned_staff: string | null;
}

interface ChecklistRow {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  go_live_approved: boolean;
  website_leads: LeadRef | null;
  clients: ClientRef | null;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = 'pending' } = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('onboarding_checklists')
    .select(
      '*, website_leads(id, full_name, business_name, assigned_to), clients(id, client_name, business_name, assigned_staff)'
    )
    .order('updated_at', { ascending: false });

  const rows = (data ?? []) as unknown as (ChecklistRow & Record<OnboardingChecklistKey, boolean>)[];

  const filtered = rows.filter((row) => {
    if (view === 'ready') return row.go_live_approved;
    if (view === 'pending') return !row.go_live_approved;
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Onboarding</h1>
          <p className="text-sm text-[#707975] mt-1">
            Offline onboarding progress. Checklists are edited from each lead or client&apos;s detail page.
          </p>
        </div>
        <div className="flex gap-1 bg-white border border-[#bfc9c4] p-1">
          {(['pending', 'ready', 'all'] as const).map((v) => (
            <Link
              key={v}
              href={`/admin/onboarding?view=${v}`}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                view === v ? 'bg-[#00342b] text-white' : 'text-[#3f4945] hover:bg-[#f5f3f3]'
              }`}
            >
              {v === 'ready' ? 'Go-Live Ready' : v}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load onboarding data: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Assigned Staff</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Go-Live</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const entity = row.clients ?? row.website_leads;
              if (!entity) return null;

              const name = 'client_name' in entity ? entity.client_name : entity.full_name;
              const assignedStaff = row.clients ? row.clients.assigned_staff : row.website_leads?.assigned_to;
              const completed = ONBOARDING_CHECKLIST_ITEMS.filter((item) => row[item.key]).length;
              const href = row.client_id ? `/admin/clients/${row.client_id}` : `/admin/inquiries/${row.lead_id}`;

              return (
                <tr key={row.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#1b1c1c]">{name}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{entity.business_name}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{assignedStaff ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">
                    {completed} / {ONBOARDING_CHECKLIST_ITEMS.length}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${row.go_live_approved ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                      {row.go_live_approved ? 'Ready' : 'Not Ready'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={href}
                      className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No onboarding records in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
