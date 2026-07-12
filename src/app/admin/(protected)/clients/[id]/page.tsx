import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ONBOARDING_STATUSES, INTEGRATION_STATUSES, type Client, type OnboardingChecklist as OnboardingChecklistRow } from '@/data/clients';
import { labelFor } from '@/data/inquiries';
import type { ServiceStatus } from '@/data/services';
import ClientDetailForm from '@/components/admin/ClientDetailForm';
import ClientServicesPanel from '@/components/admin/ClientServicesPanel';
import OnboardingChecklist from '@/components/admin/OnboardingChecklist';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: services }, { data: checklist }, { data: tickets }, { data: integrations }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('client_services').select('service_key, status').eq('client_id', id),
    supabase.from('onboarding_checklists').select('*').eq('client_id', id).maybeSingle(),
    supabase.from('support_tickets').select('id, title, status, priority, created_at').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('integration_health').select('id, service_type, api_status, last_successful_request').eq('client_id', id),
  ]);

  if (error || !data) {
    notFound();
  }

  const client = data as Client;
  const checklistRow = checklist as OnboardingChecklistRow | null;
  const serviceStatuses = Object.fromEntries(
    (services ?? []).map((s) => [s.service_key, s.status as ServiceStatus])
  );

  return (
    <div>
      <Link href="/admin/clients" className="text-sm text-[#707975] hover:text-[#00342b]">← Back to Clients</Link>

      <div className="mt-4 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">{client.client_name}</h1>
          <p className="text-sm text-[#707975] mt-1">{client.business_name} · Joined {formatDate(client.date_joined)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-[#e0f2ee] text-[#00342b]">
            {labelFor(ONBOARDING_STATUSES, client.onboarding_status)}
          </span>
          <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-[#e6e6fa] text-[#3d3d9e]">
            {labelFor(INTEGRATION_STATUSES, client.integration_status)}
          </span>
          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${client.is_active ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
            {client.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ClientDetailForm
            id={client.id}
            initialClientName={client.client_name}
            initialBusinessName={client.business_name}
            initialBusinessType={client.business_type ?? ''}
            initialContactPerson={client.contact_person ?? ''}
            initialEmail={client.email}
            initialPhone={client.phone}
            initialLocation={client.location ?? ''}
            initialOnboardingStatus={client.onboarding_status}
            initialIntegrationStatus={client.integration_status}
            initialAssignedStaff={client.assigned_staff ?? ''}
            initialInternalNotes={client.internal_notes ?? ''}
            initialIsActive={client.is_active}
          />

          <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
            <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">Support Tickets</h2>
            {tickets && tickets.length > 0 ? (
              <ul className="divide-y divide-[#e5e5e5]">
                {tickets.map((t) => (
                  <li key={t.id} className="py-2 text-sm flex items-center justify-between">
                    <span>{t.title}</span>
                    <span className="text-xs text-[#707975] capitalize">{t.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#707975]">No support tickets yet.</p>
            )}
          </div>

          <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
            <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">Integration Health</h2>
            {integrations && integrations.length > 0 ? (
              <ul className="divide-y divide-[#e5e5e5]">
                {integrations.map((i) => (
                  <li key={i.id} className="py-2 text-sm flex items-center justify-between">
                    <span>{i.service_type}</span>
                    <span className="text-xs text-[#707975] capitalize">{i.api_status.replace('_', ' ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#707975]">No integration records yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <ClientServicesPanel clientId={client.id} initialStatuses={serviceStatuses} />
          <OnboardingChecklist owner={{ clientId: client.id }} initialValues={checklistRow ?? {}} />
        </div>
      </div>
    </div>
  );
}
