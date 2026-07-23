import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { getRecordActivity } from '@/lib/audit';
import Pill from '@/components/admin/operations/Pill';
import InlineSelect from '@/components/admin/InlineSelect';
import OnboardingCaseDetailForm from '@/components/admin/operations/OnboardingCaseDetailForm';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';
import { updateOnboardingCaseStageOption } from '../actions';
import { ONBOARDING_STAGES, type OnboardingCase } from '@/data/operations';

export const dynamic = 'force-dynamic';

type CaseWithRelations = OnboardingCase & {
  clients: { business_name: string } | null;
  website_leads: { business_name: string } | null;
};

export default async function OnboardingCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let canManage = true;
  try {
    await requirePermission('onboarding.view');
  } catch {
    return <AccessDenied requiredPermission="onboarding.view" />;
  }
  try {
    await requirePermission('onboarding.manage');
  } catch {
    canManage = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: staffRows }, { data: contractRows }, { data: proformaRows }, { data: invoiceRows }, activity] = await Promise.all([
    supabase.from('onboarding_cases').select('*, clients(business_name), website_leads(business_name)').eq('id', id).single(),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('contracts').select('id, contract_number, contract_title'),
    supabase.from('proforma_invoices').select('id, proforma_number'),
    supabase.from('invoices').select('id, invoice_number'),
    getRecordActivity(supabase, 'onboarding_cases', id),
  ]);

  if (error || !data) {
    notFound();
  }

  const record = data as unknown as CaseWithRelations;
  const relatedName = record.clients?.business_name ?? record.website_leads?.business_name ?? '—';

  const stageOptions = ONBOARDING_STAGES.map((s) => ({ value: s.value, label: s.label }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/onboarding/pipeline" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Onboarding Pipeline
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-bold text-2xl text-[#00342b]">{record.case_number}</h1>
            <p className="text-sm text-[#707975] mt-1">{relatedName}</p>
          </div>
          <Pill label={record.priority} tone="neutral" />
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Stage</h2>
        {canManage ? (
          <InlineSelect
            value={record.stage}
            options={stageOptions}
            onSave={updateOnboardingCaseStageOption.bind(null, id)}
            className="border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
        ) : (
          <p className="text-sm text-[#3f4945]">{record.stage}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {canManage ? (
            <OnboardingCaseDetailForm
              id={id}
              initialPriority={record.priority}
              initialAssignedUserId={record.assigned_user_id ?? ''}
              initialDueDate={record.due_date ?? ''}
              initialNotes={record.notes ?? ''}
              initialBlockers={record.blockers ?? ''}
              initialDocumentReferences={record.document_references ?? []}
              initialRelatedContractId={record.related_contract_id ?? ''}
              initialRelatedProformaId={record.related_proforma_id ?? ''}
              initialRelatedInvoiceId={record.related_invoice_id ?? ''}
              staff={staffRows ?? []}
              contracts={(contractRows ?? []).map((c) => ({ id: c.id, label: `${c.contract_number} — ${c.contract_title}` }))}
              proformas={(proformaRows ?? []).map((p) => ({ id: p.id, label: p.proforma_number }))}
              invoices={(invoiceRows ?? []).map((i) => ({ id: i.id, label: i.invoice_number }))}
            />
          ) : (
            <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
              <p><span className="font-semibold text-[#707975]">Due Date:</span> {record.due_date ?? '—'}</p>
              <p><span className="font-semibold text-[#707975]">Blockers:</span> {record.blockers ?? '—'}</p>
              <p><span className="font-semibold text-[#707975]">Notes:</span> {record.notes ?? '—'}</p>
            </div>
          )}
        </div>
        <ActivityTimeline entries={activity} />
      </div>
    </div>
  );
}
