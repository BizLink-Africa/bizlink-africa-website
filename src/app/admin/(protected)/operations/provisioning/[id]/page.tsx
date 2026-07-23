import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ProvisioningProfileForm from '@/components/admin/operations/ProvisioningProfileForm';
import CredentialsPanel from '@/components/admin/operations/CredentialsPanel';
import { SERVICE_CATALOG } from '@/data/services';
import type { ClientProvisioning, ProvisioningStatus } from '@/data/operations';

export const dynamic = 'force-dynamic';

export default async function ClientProvisioningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let canManage = true;
  try {
    await requirePermission('provisioning.view');
  } catch {
    return <AccessDenied requiredPermission="provisioning.view" />;
  }
  try {
    await requirePermission('provisioning.manage');
  } catch {
    canManage = false;
  }

  const { id: clientId } = await params;
  const supabase = await createClient();

  const [{ data: client, error }, { data: provisioning }, { data: enabledServices }, { data: staffRows }] = await Promise.all([
    supabase.from('clients').select('id, business_name').eq('id', clientId).single(),
    supabase.from('client_provisioning').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('client_services').select('service_key').eq('client_id', clientId).eq('status', 'active'),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  if (error || !client) {
    notFound();
  }

  const profile = provisioning as ClientProvisioning | null;
  const serviceLabels = (enabledServices ?? [])
    .map((s) => SERVICE_CATALOG.find((c) => c.value === s.service_key)?.label ?? s.service_key)
    .join(', ');

  const { data: credentials } = profile
    ? await supabase
        .from('provisioning_credentials')
        .select('id, credential_type, label, masked_preview, created_at')
        .eq('provisioning_id', profile.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/operations/provisioning" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Client Provisioning
        </Link>
        <h1 className="font-bold text-2xl text-[#00342b]">{client.business_name}</h1>
        <p className="text-sm text-[#707975] mt-1">Active services: {serviceLabels || 'none activated yet'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canManage ? (
          <ProvisioningProfileForm
            clientId={clientId}
            initialEnabledModules={profile?.enabled_modules ?? []}
            initialTechnicalOwner={profile?.technical_owner ?? ''}
            initialActivationDate={profile?.activation_date ?? ''}
            initialTrainingStatus={(profile?.training_status as ProvisioningStatus) ?? 'not_started'}
            initialHandoverStatus={(profile?.handover_status as ProvisioningStatus) ?? 'not_started'}
            initialNotes={profile?.notes ?? ''}
            staff={staffRows ?? []}
          />
        ) : (
          <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
            <p><span className="font-semibold text-[#707975]">Enabled Modules:</span> {(profile?.enabled_modules ?? []).join(', ') || '—'}</p>
            <p><span className="font-semibold text-[#707975]">Training:</span> {profile?.training_status ?? 'not_started'}</p>
            <p><span className="font-semibold text-[#707975]">Handover:</span> {profile?.handover_status ?? 'not_started'}</p>
          </div>
        )}

        <CredentialsPanel
          provisioningId={profile?.id ?? null}
          clientId={clientId}
          credentials={credentials ?? []}
          readOnly={!canManage}
        />
      </div>
    </div>
  );
}
