import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { getRecordActivity } from '@/lib/audit';
import { ONBOARDING_STATUSES, INTEGRATION_STATUSES, type Client, type OnboardingChecklist as OnboardingChecklistRow } from '@/data/clients';
import type { ClientContact } from '@/data/crm';
import { labelFor } from '@/data/inquiries';
import type { ServiceStatus } from '@/data/services';
import ClientDetailForm from '@/components/admin/ClientDetailForm';
import ClientServicesPanel from '@/components/admin/ClientServicesPanel';
import OnboardingChecklist from '@/components/admin/OnboardingChecklist';
import ClientOwnerControl from '@/components/admin/crm/ClientOwnerControl';
import ClientContactsPanel from '@/components/admin/crm/ClientContactsPanel';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let canManage = true;
  try {
    await requirePermission('clients.view');
  } catch {
    return notFound();
  }
  try {
    await requirePermission('clients.update');
  } catch {
    canManage = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [
    { data, error },
    { data: services },
    { data: checklist },
    { data: tickets },
    { data: integrations },
    { data: contracts },
    { data: proformas },
    { data: invoices },
    { data: aiAgents },
    { data: contacts },
    { data: staffRows },
    activity,
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('client_services').select('service_key, status').eq('client_id', id),
    supabase.from('onboarding_checklists').select('*').eq('client_id', id).maybeSingle(),
    supabase.from('support_tickets').select('id, title, status, priority, created_at').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('integration_health').select('id, service_type, api_status, last_successful_request').eq('client_id', id),
    supabase.from('contracts').select('id, contract_number, contract_title, status').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('proforma_invoices').select('id, proforma_number, total, currency, status').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, invoice_number, total, currency, status, outstanding_balance').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('ai_agent_configs').select('id, agent_type, agent_status').eq('client_id', id),
    supabase.from('client_contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    getRecordActivity(supabase, 'clients', id),
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
          <h1 className="font-bold text-2xl text-[#00342b]">{client.client_name}</h1>
          <p className="text-sm text-[#707975] mt-1">
            {client.client_number ?? '—'} · {client.business_name} · Joined {formatDate(client.date_joined)}
          </p>
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
            initialIndustry={client.industry ?? ''}
            initialOnboardingStatus={client.onboarding_status}
            initialIntegrationStatus={client.integration_status}
            initialInternalNotes={client.internal_notes ?? ''}
            initialIsActive={client.is_active}
          />

          {canManage && (
            <div className="bg-white border border-[#bfc9c4] p-6">
              <ClientOwnerControl id={client.id} accountOwnerId={client.account_owner_id} staff={staffRows ?? []} />
            </div>
          )}

          <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
            <h2 className="font-semibold text-[#00342b]">Contracts</h2>
            {contracts && contracts.length > 0 ? (
              <ul className="divide-y divide-[#e5e5e5]">
                {contracts.map((c) => (
                  <li key={c.id} className="py-2 text-sm flex items-center justify-between">
                    <Link href={`/admin/contracts/${c.id}`} className="hover:underline">{c.contract_number} — {c.contract_title}</Link>
                    <span className="text-xs text-[#707975] capitalize">{c.status.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#707975]">No contracts yet.</p>
            )}
          </div>

          <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
            <h2 className="font-semibold text-[#00342b]">Proformas &amp; Invoices</h2>
            {(proformas && proformas.length > 0) || (invoices && invoices.length > 0) ? (
              <ul className="divide-y divide-[#e5e5e5]">
                {(proformas ?? []).map((p) => (
                  <li key={p.id} className="py-2 text-sm flex items-center justify-between">
                    <Link href={`/admin/finance/proformas/${p.id}`} className="hover:underline">{p.proforma_number} (Proforma)</Link>
                    <span className="text-xs text-[#707975]">{p.currency} {p.total.toLocaleString()} · {p.status}</span>
                  </li>
                ))}
                {(invoices ?? []).map((i) => (
                  <li key={i.id} className="py-2 text-sm flex items-center justify-between">
                    <Link href={`/admin/finance/invoices/${i.id}`} className="hover:underline">{i.invoice_number} (Invoice)</Link>
                    <span className="text-xs text-[#707975]">{i.currency} {i.total.toLocaleString()} · {i.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#707975]">No proformas or invoices yet.</p>
            )}
          </div>

          <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
            <h2 className="font-semibold text-[#00342b]">Support Tickets</h2>
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
            <h2 className="font-semibold text-[#00342b]">Integrations &amp; AI Agents</h2>
            {(integrations && integrations.length > 0) || (aiAgents && aiAgents.length > 0) ? (
              <ul className="divide-y divide-[#e5e5e5]">
                {(integrations ?? []).map((i) => (
                  <li key={i.id} className="py-2 text-sm flex items-center justify-between">
                    <span>{i.service_type}</span>
                    <span className="text-xs text-[#707975] capitalize">{i.api_status.replace('_', ' ')}</span>
                  </li>
                ))}
                {(aiAgents ?? []).map((a) => (
                  <li key={a.id} className="py-2 text-sm flex items-center justify-between">
                    <span className="capitalize">{a.agent_type.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-[#707975] capitalize">{a.agent_status.replace('_', ' ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#707975]">No integration or AI agent records yet.</p>
            )}
          </div>

          <div className="bg-white border border-dashed border-[#bfc9c4] p-6">
            <h2 className="font-semibold text-[#00342b] mb-1">Projects</h2>
            <p className="text-sm text-[#707975]">No dedicated projects tracking exists yet — see Contracts and Services above.</p>
          </div>
        </div>

        <div className="space-y-6">
          <ClientServicesPanel clientId={client.id} initialStatuses={serviceStatuses} />
          <ClientContactsPanel clientId={client.id} contacts={(contacts ?? []) as ClientContact[]} canManage={canManage} />
          <OnboardingChecklist owner={{ clientId: client.id }} initialValues={checklistRow ?? {}} />
          <ActivityTimeline entries={activity} />
        </div>
      </div>
    </div>
  );
}
