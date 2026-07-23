import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ContractActionButtons from '@/components/admin/ContractActionButtons';
import UploadContractVersionForm from '@/components/admin/UploadContractVersionForm';
import ContractFileDownloadLink from '@/components/admin/ContractFileDownloadLink';
import SensitiveDetailsForm from '@/components/admin/SensitiveDetailsForm';
import AmendmentsPanel from '@/components/admin/AmendmentsPanel';
import { CONTRACT_STATUSES, labelFor, computeExpiryFlag, type Contract, type ContractVersion, type ContractSensitiveDetails } from '@/data/contracts';

export const dynamic = 'force-dynamic';

interface AuditRow {
  id: string;
  performed_by: string;
  action_type: string;
  created_at: string;
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('contracts.view');
  } catch {
    return <AccessDenied requiredPermission="contracts.view" />;
  }
  let canUpload = true;
  try {
    await requirePermission('contracts.update');
  } catch {
    canUpload = false;
  }
  let canViewSensitive = true;
  try {
    await requirePermission('contracts.sensitive.view');
  } catch {
    canViewSensitive = false;
  }
  let canManageSensitive = true;
  try {
    await requirePermission('contracts.sensitive.manage');
  } catch {
    canManageSensitive = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: contract, error }, { data: versions }, { data: activity }, { data: amendments }, sensitiveResult] = await Promise.all([
    supabase.from('contracts').select('*').eq('id', id).single(),
    supabase.from('contract_versions').select('*').eq('contract_id', id).order('version_number', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('id, performed_by, action_type, created_at')
      .eq('module', 'contracts')
      .eq('record_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('contract_amendments').select('*').eq('contract_id', id).order('created_at', { ascending: false }),
    canViewSensitive
      ? supabase.from('contract_sensitive_details').select('*').eq('contract_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const sensitiveDetails = (sensitiveResult.data ?? null) as ContractSensitiveDetails | null;

  if (error || !contract) notFound();
  const c = contract as Contract;
  const versionRows = (versions ?? []) as ContractVersion[];
  const activityRows = (activity ?? []) as AuditRow[];

  let clientName: string | null = null;
  if (c.client_id) {
    const { data: clientRow } = await supabase.from('clients').select('business_name').eq('id', c.client_id).maybeSingle();
    clientName = clientRow?.business_name ?? null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const expiryFlag = computeExpiryFlag(c.status, c.end_date, c.renewal_notice_period_days, today);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/contracts" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to Contracts
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{c.contract_number}</h1>
          <p className="text-sm text-[#707975] mt-1">{c.contract_title}</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-[#e0f2ee] text-[#00342b]">
            {labelFor(CONTRACT_STATUSES, c.status)}
          </span>
          {expiryFlag && (
            <p className={`text-xs font-medium mt-1 ${expiryFlag === 'expired' ? 'text-red-700' : 'text-[#8a5a00]'}`}>
              {expiryFlag === 'expired' ? 'Expired' : 'Expiring soon'}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Actions</h2>
        <ContractActionButtons id={c.id} status={c.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Details</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Client</dt><dd className="text-[#1b1c1c]">{clientName ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Contract Value</dt><dd className="text-[#1b1c1c]">{c.contract_value ? `${c.currency} ${c.contract_value.toLocaleString()}` : '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Payment Terms</dt><dd className="text-[#1b1c1c]">{c.payment_terms ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Start Date</dt><dd className="text-[#1b1c1c]">{c.start_date ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">End Date</dt><dd className="text-[#1b1c1c]">{c.end_date ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Renewal Date</dt><dd className="text-[#1b1c1c]">{c.renewal_date ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Signed Date</dt><dd className="text-[#1b1c1c]">{c.signed_date ?? '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Ownership</h2>
          <dl className="text-sm space-y-2">
            <div><dt className="text-xs text-[#707975]">Contract Owner</dt><dd className="text-[#1b1c1c]">{c.contract_owner ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Operations Owner</dt><dd className="text-[#1b1c1c]">{c.operations_owner ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Created By</dt><dd className="text-[#1b1c1c]">{c.created_by ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Approved By</dt><dd className="text-[#1b1c1c]">{c.approved_by ?? '—'}</dd></div>
          </dl>
          {c.notes && (
            <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
              <p className="text-xs text-[#707975] mb-1">Notes</p>
              <p className="text-sm text-[#1b1c1c]">{c.notes}</p>
            </div>
          )}
        </div>
      </div>

      {(c.merchant_agent_name || c.outlet_name || c.business_name || c.address || c.contact_name) && (
        <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Outlet / Merchant Profile</h2>
          <dl className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <div><dt className="text-xs text-[#707975]">Merchant/Agent Name</dt><dd className="text-[#1b1c1c]">{c.merchant_agent_name ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Outlet Name</dt><dd className="text-[#1b1c1c]">{c.outlet_name ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Business Name</dt><dd className="text-[#1b1c1c]">{c.business_name ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Business Registration Number</dt><dd className="text-[#1b1c1c]">{c.business_registration_number ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Type of Business</dt><dd className="text-[#1b1c1c]">{c.business_type ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Main Products or Services</dt><dd className="text-[#1b1c1c]">{c.main_products_or_services ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Year of Incorporation</dt><dd className="text-[#1b1c1c]">{c.year_of_incorporation ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Years of Operation</dt><dd className="text-[#1b1c1c]">{c.years_of_operation ?? '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-[#707975]">Address</dt><dd className="text-[#1b1c1c]">{c.address ?? '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">City / District</dt><dd className="text-[#1b1c1c]">{[c.city, c.district].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Ward / Region</dt><dd className="text-[#1b1c1c]">{[c.ward, c.region].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">GPS</dt><dd className="text-[#1b1c1c]">{c.gps_latitude && c.gps_longitude ? `${c.gps_latitude}, ${c.gps_longitude}` : '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Contact</dt><dd className="text-[#1b1c1c]">{c.contact_name ?? '—'} {c.contact_designation ? `(${c.contact_designation})` : ''}</dd></div>
            <div><dt className="text-xs text-[#707975]">Contact Phone / Email</dt><dd className="text-[#1b1c1c]">{[c.contact_phone, c.contact_email].filter(Boolean).join(' / ') || '—'}</dd></div>
            <div><dt className="text-xs text-[#707975]">Notification Phone / Email</dt><dd className="text-[#1b1c1c]">{[c.notification_phone, c.notification_email].filter(Boolean).join(' / ') || '—'}</dd></div>
          </dl>
        </div>
      )}

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-1">Merchant KYC &amp; Banking Details</h2>
        <p className="text-xs text-[#707975] mb-4">Restricted to Compliance &amp; Security. Never included in exports or audit log values.</p>
        {canViewSensitive ? (
          <SensitiveDetailsForm contractId={c.id} existing={sensitiveDetails} readOnly={!canManageSensitive} />
        ) : (
          <p className="text-sm text-[#707975] italic">
            You don&apos;t have permission to view this section. Contact a Super Admin or Compliance &amp; Security if you need access.
          </p>
        )}
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Contract Files</h2>
        {canUpload && (
          <div className="mb-4 pb-4 border-b border-[#e5e5e5]">
            <UploadContractVersionForm contractId={c.id} />
          </div>
        )}
        {versionRows.length === 0 ? (
          <p className="text-sm text-[#707975]">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {versionRows.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-sm py-1">
                <div>
                  <span className="font-medium text-[#1b1c1c]">v{v.version_number} — {v.file_name}</span>
                  <span className="text-xs text-[#707975] ml-2">
                    {v.uploaded_by} • {new Date(v.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <ContractFileDownloadLink filePath={v.file_path} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <AmendmentsPanel contractId={c.id} amendments={amendments ?? []} canManage={canUpload} />

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Activity History</h2>
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
