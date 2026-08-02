import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CaseActions from '@/components/admin/chargebacks/CaseActions';
import EvidenceChecklist from '@/components/admin/chargebacks/EvidenceChecklist';
import { formatMoney } from '@/lib/collections/money';
import {
  CHARGEBACK_CASE_STATUSES,
  CHARGEBACK_CASE_STATUS_COLORS,
  CHARGEBACK_REASONS,
  CHARGEBACK_RECOVERY_STATUSES,
  CHARGEBACK_CASE_EVENT_LABELS,
  type ChargebackCase,
  type ChargebackCaseEvent,
  type ChargebackEvidenceItem,
} from '@/data/chargebacks';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function ChargebackCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('chargebacks.view');
  } catch {
    return <AccessDenied requiredPermission="chargebacks.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('chargebacks.manage');
  } catch {
    canManage = false;
  }
  let canResolve = true;
  try {
    await requirePermission('chargebacks.resolve');
  } catch {
    canResolve = false;
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: caseRow } = await supabase.from('chargeback_cases').select('*').eq('id', id).maybeSingle();
  if (!caseRow) notFound();
  const c = caseRow as ChargebackCase;

  const [{ data: merchant }, { data: txn }, { data: evidenceRows }, { data: eventRows }] = await Promise.all([
    supabase.from('merchants').select('business_name').eq('id', c.merchant_id).maybeSingle(),
    supabase.from('collection_transactions').select('provider_transaction_reference, gross_amount, currency').eq('id', c.original_transaction_id).maybeSingle(),
    supabase.from('chargeback_evidence_items').select('*').eq('case_id', id),
    supabase.from('chargeback_case_events').select('*').eq('case_id', id).order('performed_at', { ascending: true }),
  ]);
  const evidenceItems = (evidenceRows ?? []) as ChargebackEvidenceItem[];
  const events = (eventRows ?? []) as ChargebackCaseEvent[];

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/admin/chargebacks" className="text-xs font-medium text-[#00342b] hover:underline">← All Cases</Link>
      </div>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{c.case_reference}</h1>
          <p className="text-sm text-[#707975] mt-1">{merchant?.business_name ?? c.merchant_id} · {txn?.provider_transaction_reference ?? c.original_transaction_id}</p>
        </div>
        <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${CHARGEBACK_CASE_STATUS_COLORS[c.case_status] ?? ''}`}>
          {labelFor(CHARGEBACK_CASE_STATUSES, c.case_status)}
        </span>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4 mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Disputed Amount" value={formatMoney(c.disputed_amount, 'TZS')} bold />
          <Field label="Associated Fee" value={formatMoney(c.associated_fee, 'TZS')} />
          <Field label="Reason" value={labelFor(CHARGEBACK_REASONS, c.reason)} />
          <Field label="Evidence Due" value={c.evidence_due_at ? new Date(c.evidence_due_at).toLocaleString('en-GB') : '—'} />
          <Field label="Recovery Status" value={labelFor(CHARGEBACK_RECOVERY_STATUSES, c.recovery_status)} />
          <Field label="Recovery Amount" value={c.recovery_amount ? formatMoney(c.recovery_amount, 'TZS') : '—'} />
        </dl>
        {c.resolution_notes && <p className="text-xs text-[#707975] border-t border-[#efeded] pt-3">Resolution: {c.resolution_notes}</p>}
        {c.recovery_notes && <p className="text-xs text-[#707975]">Recovery notes: {c.recovery_notes} ({c.recovery_method})</p>}
      </div>

      <div className="mb-6">
        <CaseActions caseId={c.id} caseStatus={c.case_status} recoveryStatus={c.recovery_status} canManage={canManage} canResolve={canResolve} />
      </div>

      <div className="mb-6">
        <EvidenceChecklist caseId={c.id} items={evidenceItems} canManage={canManage} />
      </div>

      <h2 className="font-semibold text-[#00342b] mb-3">Case Timeline</h2>
      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
        {events.map((e) => (
          <div key={e.id} className="p-4">
            <p className="text-sm font-medium text-[#1b1c1c]">{CHARGEBACK_CASE_EVENT_LABELS[e.event_type] ?? e.event_type}</p>
            <p className="text-xs text-[#707975] mt-0.5">{e.performed_by} · {new Date(e.performed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            {e.notes && <p className="text-xs text-[#3f4945] mt-1 italic">&quot;{e.notes}&quot;</p>}
          </div>
        ))}
        {events.length === 0 && <p className="p-4 text-center text-sm text-[#707975]">No events recorded yet.</p>}
      </div>
    </div>
  );
}

function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <dt className="font-semibold text-[#707975] uppercase tracking-wider text-xs mb-0.5">{label}</dt>
      <dd className={bold ? 'font-semibold text-[#00342b]' : 'text-[#1b1c1c]'}>{value}</dd>
    </div>
  );
}
