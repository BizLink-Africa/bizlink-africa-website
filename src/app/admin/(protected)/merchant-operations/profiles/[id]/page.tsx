import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import MerchantStatusPanel from '@/components/admin/merchant/MerchantStatusPanel';
import MerchantEditForm from '@/components/admin/merchant/MerchantEditForm';
import MerchantNotesPanel from '@/components/admin/merchant/MerchantNotesPanel';
import MerchantDocumentChecklist from '@/components/admin/merchant/MerchantDocumentChecklist';
import MerchantStaffAssignment from '@/components/admin/merchant/MerchantStaffAssignment';
import MerchantComplianceHoldPanel from '@/components/admin/merchant/MerchantComplianceHoldPanel';
import {
  MERCHANT_ONBOARDING_STATUSES,
  MERCHANT_ONBOARDING_STATUS_COLORS,
  MERCHANT_RISK_STATUSES,
  MERCHANT_RISK_COLORS,
  MERCHANT_REGISTRATION_TYPES,
  MERCHANT_EXPECTED_VOLUME_RANGES,
  type Merchant,
  type MerchantStatusHistoryEntry,
  type MerchantNote,
  type MerchantDocument,
} from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  performed_by: string;
  action_type: string;
  created_at: string;
}

export default async function MerchantProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('merchants.view');
  } catch {
    return <AccessDenied requiredPermission="merchants.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('merchants.manage');
  } catch {
    canManage = false;
  }
  let canComplianceHold = true;
  try {
    await requirePermission('merchants.compliance_hold');
  } catch {
    canComplianceHold = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: merchant, error },
    { data: statusHistory },
    { data: notes },
    { data: documents },
    { data: activity },
    { data: staffRows },
  ] = await Promise.all([
    supabase.from('merchants').select('*').eq('id', id).single(),
    supabase.from('merchant_status_history').select('*').eq('merchant_id', id).order('changed_at', { ascending: false }),
    supabase.from('merchant_notes').select('*').eq('merchant_id', id).order('created_at', { ascending: false }),
    supabase.from('merchant_documents').select('*').eq('merchant_id', id).order('document_type'),
    supabase
      .from('audit_logs')
      .select('id, performed_by, action_type, created_at')
      .eq('module', 'merchants')
      .eq('record_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ]);

  if (error || !merchant) notFound();
  const m = merchant as Merchant;
  const historyRows = (statusHistory ?? []) as MerchantStatusHistoryEntry[];
  const noteRows = (notes ?? []) as MerchantNote[];
  const documentRows = (documents ?? []) as MerchantDocument[];
  const activityRows = (activity ?? []) as AuditRow[];
  const staffOptions = (staffRows ?? []) as { id: string; full_name: string }[];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/merchant-operations/profiles" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to Merchant Profiles
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{m.business_name}</h1>
          {m.trading_name && <p className="text-sm text-[#707975] mt-1">Trading as {m.trading_name}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_ONBOARDING_STATUS_COLORS[m.onboarding_status] ?? ''}`}>
            {labelFor(MERCHANT_ONBOARDING_STATUSES, m.onboarding_status)}
          </span>
          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_RISK_COLORS[m.risk_status] ?? ''}`}>
            {labelFor(MERCHANT_RISK_STATUSES, m.risk_status)} Risk
          </span>
        </div>
      </div>

      {m.compliance_hold && (
        <div className="mb-6 bg-[#fbe4e4] border border-[#e0a3a3] px-4 py-3">
          <p className="text-sm font-semibold text-[#8a1f1f]">Compliance Hold Active</p>
          {m.compliance_hold_reason && <p className="text-sm text-[#8a1f1f] mt-1">{m.compliance_hold_reason}</p>}
        </div>
      )}

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Onboarding Status</h2>
        <MerchantStatusPanel merchantId={m.id} currentStatus={m.onboarding_status} canManage={canManage} history={historyRows} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Business Details</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Registration Type</dt><dd className="text-[#1b1c1c]">{m.registration_type ? labelFor(MERCHANT_REGISTRATION_TYPES, m.registration_type) : '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">TIN</dt><dd className="text-[#1b1c1c]">{m.tin ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Licence Number</dt><dd className="text-[#1b1c1c]">{m.licence_number ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Business Category</dt><dd className="text-[#1b1c1c]">{m.business_category ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Business Address</dt><dd className="text-[#1b1c1c]">{m.business_address ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Expected Volume</dt><dd className="text-[#1b1c1c]">{m.expected_volume ? labelFor(MERCHANT_EXPECTED_VOLUME_RANGES, m.expected_volume) : '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Contact &amp; References</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Contact Person</dt><dd className="text-[#1b1c1c]">{m.contact_person_name ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Phone</dt><dd className="text-[#1b1c1c]">{m.contact_phone ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Email</dt><dd className="text-[#1b1c1c]">{m.contact_email ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Partner Merchant Reference</dt><dd className="text-[#1b1c1c]">{m.partner_merchant_reference ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Till/Payment-Account Reference</dt><dd className="text-[#1b1c1c]">{m.till_reference ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Settlement Status</dt><dd className="text-[#1b1c1c] capitalize">{m.settlement_status.replace(/_/g, ' ')}</dd></div>
          </dl>
          <p className="text-xs text-[#707975] mt-4 pt-4 border-t border-[#e5e5e5]">
            Created {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Updated {new Date(m.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
          <h2 className="font-semibold text-[#00342b] mb-4">Edit Profile</h2>
          <MerchantEditForm merchant={m} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Assigned Staff</h2>
          <MerchantStaffAssignment merchantId={m.id} currentStaffId={m.assigned_staff_id} staff={staffOptions} canManage={canManage} />
        </div>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Compliance Hold</h2>
          <MerchantComplianceHoldPanel merchantId={m.id} hold={m.compliance_hold} reason={m.compliance_hold_reason} canManage={canComplianceHold} />
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-1">Document Checklist</h2>
        <p className="text-xs text-[#707975] mb-4">Status tracking only — documents are exchanged offline, not uploaded here.</p>
        <MerchantDocumentChecklist merchantId={m.id} documents={documentRows} canManage={canManage} />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Internal Notes</h2>
        <MerchantNotesPanel merchantId={m.id} notes={noteRows} canManage={canManage} />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Audit Timeline</h2>
        {activityRows.length === 0 ? (
          <p className="text-sm text-[#707975]">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activityRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between text-[#3f4945]">
                <span className="capitalize">{row.action_type.replace(/_/g, ' ')} by {row.performed_by}</span>
                <span className="text-xs text-[#707975]">{new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
