import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { ONBOARDING_STATUSES, INTEGRATION_STATUSES, type Client } from '@/data/clients';
import { labelFor } from '@/data/inquiries';
import ClientFilters from '@/components/admin/ClientFilters';
import AddClientForm from '@/components/admin/AddClientForm';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  onboarding?: string;
  integration?: string;
  active?: string;
}

const ONBOARDING_COLORS: Record<string, string> = {
  not_started: 'bg-[#eeeeee] text-[#3f4945]',
  in_progress: 'bg-[#fef3e0] text-[#8a5a00]',
  completed: 'bg-[#dcf5e3] text-[#1b7a3d]',
};

const INTEGRATION_COLORS: Record<string, string> = {
  not_started: 'bg-[#eeeeee] text-[#3f4945]',
  in_progress: 'bg-[#fef3e0] text-[#8a5a00]',
  active: 'bg-[#dcf5e3] text-[#1b7a3d]',
  issue: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  let canCreate = true;
  try {
    await requirePermission('clients.view');
  } catch {
    return <AccessDenied requiredPermission="clients.view" />;
  }
  try {
    await requirePermission('clients.create');
  } catch {
    canCreate = false;
  }

  const params = await searchParams;
  const supabase = await createClient();

  const { data: staffRows } = await supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name');
  const staffNameById = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));

  let query = supabase
    .from('clients')
    .select('id, client_number, client_name, business_name, business_type, email, phone, location, onboarding_status, integration_status, account_owner_id, is_active, date_joined')
    .order('created_at', { ascending: false });

  if (params.q) {
    const term = params.q.trim();
    query = query.or(
      `client_name.ilike.%${term}%,business_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,location.ilike.%${term}%`
    );
  }
  if (params.onboarding) {
    query = query.eq('onboarding_status', params.onboarding);
  }
  if (params.integration) {
    query = query.eq('integration_status', params.integration);
  }
  if (params.active) {
    query = query.eq('is_active', params.active === 'true');
  }

  const { data, error } = await query;
  const clients = (data ?? []) as Pick<
    Client,
    'id' | 'client_number' | 'client_name' | 'business_name' | 'business_type' | 'email' | 'phone' | 'location' | 'onboarding_status' | 'integration_status' | 'account_owner_id' | 'is_active' | 'date_joined'
  >[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Clients</h1>
          <p className="text-sm text-[#707975] mt-1">{clients.length} result{clients.length === 1 ? '' : 's'}</p>
        </div>
        {canCreate && <AddClientForm staff={staffRows ?? []} />}
      </div>

      <ClientFilters onboardingStatuses={ONBOARDING_STATUSES} integrationStatuses={INTEGRATION_STATUSES} />

      {error && (
        <p className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load clients: {error.message}
        </p>
      )}

      <div className="mt-6 bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Onboarding</th>
              <th className="px-4 py-3">Integration</th>
              <th className="px-4 py-3">Assigned Staff</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3">
                  <Link href={`/admin/clients/${client.id}`} className="font-medium text-[#00342b] hover:underline">
                    {client.client_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{client.business_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">
                  <div>{client.email}</div>
                  <div className="text-xs text-[#707975]">{client.phone}</div>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{client.location ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${ONBOARDING_COLORS[client.onboarding_status] ?? ''}`}>
                    {labelFor(ONBOARDING_STATUSES, client.onboarding_status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${INTEGRATION_COLORS[client.integration_status] ?? ''}`}>
                    {labelFor(INTEGRATION_STATUSES, client.integration_status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{client.account_owner_id ? staffNameById.get(client.account_owner_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${client.is_active ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No clients yet. Convert a lead from the Leads page, or add one manually above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
