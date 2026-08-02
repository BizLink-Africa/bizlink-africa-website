import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { requirePermission, verifyAdminSession } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { hasRecentReauth } from '@/lib/supabase/reauth';
import AccessDenied from '@/components/admin/AccessDenied';
import ReauthPrompt from '@/components/admin/merchant/ReauthPrompt';
import AddBeneficiaryForm from '@/components/admin/merchant/AddBeneficiaryForm';
import BeneficiaryRowActions from '@/components/admin/merchant/BeneficiaryRowActions';
import BeneficiaryApprovalQueueRow from '@/components/admin/merchant/BeneficiaryApprovalQueueRow';
import AccountLookupPanel from '@/components/admin/merchant/AccountLookupPanel';
import {
  MERCHANT_BENEFICIARY_TYPES,
  MERCHANT_BENEFICIARY_VERIFICATION_STATUSES,
  MERCHANT_BENEFICIARY_STATUS_COLORS,
  MERCHANT_BENEFICIARY_CHANGE_REQUEST_TYPES,
  MERCHANT_BENEFICIARY_REQUEST_STATUS_COLORS,
  isBeneficiaryPayable,
  type MerchantSettlementBeneficiary,
  type MerchantBeneficiaryChangeRequest,
  type SelcomInstitutionCode,
  type MerchantBeneficiaryLookup,
} from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

const BENEFICIARY_COLUMNS =
  'id, merchant_id, destination_type, account_holder_name, bank_or_network_name, bank_or_network_code, masked_destination_value, verification_status, verification_method, is_primary, verified_at, verified_by, activated_at, deactivated_at, change_reason, cooling_period_ends_at, created_by, created_at, updated_at';

export default async function MerchantBeneficiariesWorkspacePage({ params }: { params: Promise<{ merchantId: string }> }) {
  try {
    await requirePermission('merchant_beneficiaries.view');
  } catch {
    return <AccessDenied requiredPermission="merchant_beneficiaries.view" />;
  }
  let canPropose = true;
  try {
    await requirePermission('merchant_beneficiaries.manage');
  } catch {
    canPropose = false;
  }
  let canApprove = true;
  try {
    await requirePermission('merchant_beneficiaries.approve');
  } catch {
    canApprove = false;
  }

  const { merchantId } = await params;

  if (!(await hasRecentReauth())) {
    return <ReauthPrompt />;
  }

  const user = await verifyAdminSession();
  const supabase = await createClient();

  const [{ data: merchant, error }, { data: beneficiaryRows }, { data: requestRows }, { data: institutionCodeRows }, { data: lookupRows }] =
    await Promise.all([
      supabase.from('merchants').select('id, business_name').eq('id', merchantId).single(),
      // Never selects encrypted_destination_value — this query is the
      // "ordinary table" the spec means: masked value only.
      supabase.from('merchant_settlement_beneficiaries').select(BENEFICIARY_COLUMNS).eq('merchant_id', merchantId).order('created_at', { ascending: false }),
      supabase.from('merchant_beneficiary_change_requests').select('*').eq('merchant_id', merchantId).order('requested_at', { ascending: false }),
      supabase.from('selcom_institution_codes').select('code, name, category, is_active').eq('is_active', true).order('name'),
      supabase.from('merchant_beneficiary_lookups').select('*').eq('merchant_id', merchantId).order('performed_at', { ascending: false }).limit(25),
    ]);

  if (error || !merchant) notFound();

  const beneficiaries = (beneficiaryRows ?? []) as MerchantSettlementBeneficiary[];
  const requests = (requestRows ?? []) as MerchantBeneficiaryChangeRequest[];
  const pendingRequests = requests.filter((r) => r.status === 'pending_approval');
  const institutionCodes = (institutionCodeRows ?? []) as SelcomInstitutionCode[];
  const lookups = (lookupRows ?? []) as MerchantBeneficiaryLookup[];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/merchant-operations/beneficiaries" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to Settlement Beneficiaries
      </Link>

      <h1 className="font-bold text-2xl text-[#00342b] mb-1">{merchant.business_name}</h1>
      <p className="text-sm text-[#707975] mb-6">Settlement Beneficiaries</p>

      <div className="mb-6 bg-[#e0f2ee] border border-[#94d3c1] p-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-[#00342b] mt-0.5 shrink-0" />
        <p className="text-xs text-[#00342b] leading-relaxed">
          Account and wallet numbers are masked everywhere and encrypted at rest — no page ever displays the full
          value. Every add, change, verify, and suspend request requires a different staff member to approve it
          before it takes effect, and a cooling period applies afterward before the beneficiary can be paid out to.
        </p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Beneficiaries</h2>
        <ul className="divide-y divide-[#efeded] mb-6">
          {beneficiaries.map((b) => {
            const payable = isBeneficiaryPayable(b);
            return (
              <li key={b.id} className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                  <div>
                    <span className="text-sm font-medium text-[#1b1c1c]">{b.account_holder_name}</span>
                    {b.is_primary && <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#e0f2ee] text-[#00342b]">Primary</span>}
                  </div>
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_BENEFICIARY_STATUS_COLORS[b.verification_status] ?? ''}`}>
                    {labelFor(MERCHANT_BENEFICIARY_VERIFICATION_STATUSES, b.verification_status)}
                  </span>
                </div>
                <p className="text-xs text-[#707975] mb-1">
                  {labelFor(MERCHANT_BENEFICIARY_TYPES, b.destination_type)} · {b.bank_or_network_name ?? '—'} · {b.masked_destination_value}
                </p>
                <p className="text-xs mb-3">
                  {payable ? (
                    <span className="text-[#1b7a3d] font-medium">Payable</span>
                  ) : (
                    <span className="text-[#8a1f1f] font-medium">
                      Not payable{b.cooling_period_ends_at && new Date(b.cooling_period_ends_at) > new Date() ? ` — cooling period until ${new Date(b.cooling_period_ends_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                    </span>
                  )}
                </p>
                <BeneficiaryRowActions merchantId={merchantId} beneficiaryId={b.id} canPropose={canPropose} institutionCodes={institutionCodes} />
              </li>
            );
          })}
          {beneficiaries.length === 0 && <p className="text-sm text-[#707975] py-4">No beneficiaries recorded yet.</p>}
        </ul>

        <div className="flex flex-wrap gap-2">
          {canPropose && <AddBeneficiaryForm merchantId={merchantId} mode="add" />}
          <AccountLookupPanel
            merchantId={merchantId}
            institutionCodes={institutionCodes}
            canLookup={canPropose}
            triggerLabel="Look Up Account Before Adding"
          />
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
          <h2 className="font-semibold text-[#00342b] mb-1">Pending Approval</h2>
          <p className="text-xs text-[#707975] mb-4">Maker-checker: the approver must be a different person from the requester.</p>
          <ul className="divide-y divide-[#efeded]">
            {pendingRequests.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-sm font-medium text-[#1b1c1c]">{labelFor(MERCHANT_BENEFICIARY_CHANGE_REQUEST_TYPES, r.request_type)}</span>
                  {r.proposed_masked_value && <span className="text-xs text-[#707975] ml-2">{r.proposed_masked_value}</span>}
                  <p className="text-xs text-[#707975]">{r.change_reason}</p>
                  <p className="text-xs text-[#707975]">Requested by {r.requested_by} on {new Date(r.requested_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                {canApprove && (
                  <BeneficiaryApprovalQueueRow
                    requestId={r.id}
                    merchantId={merchantId}
                    requestType={r.request_type}
                    isOwnRequest={r.requested_by === (user.email ?? '')}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">History</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-[#707975]">No change requests recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-[#3f4945] border-b border-[#efeded] last:border-0 pb-2 last:pb-0">
                <div>
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full mr-2 ${MERCHANT_BENEFICIARY_REQUEST_STATUS_COLORS[r.status] ?? ''}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                  {labelFor(MERCHANT_BENEFICIARY_CHANGE_REQUEST_TYPES, r.request_type)} by {r.requested_by}
                  {r.reviewed_by && ` · reviewed by ${r.reviewed_by}`}
                </div>
                <span className="text-xs text-[#707975]">{new Date(r.requested_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mt-6">
        <h2 className="font-semibold text-[#00342b] mb-1">Account Lookup History</h2>
        <p className="text-xs text-[#707975] mb-4">
          Every Selcom account-lookup attempt for this merchant — never shows a full account number, and a lookup
          alone never marks a beneficiary verified.
        </p>
        {lookups.length === 0 ? (
          <p className="text-sm text-[#707975]">No account lookups recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {lookups.map((l) => (
              <li key={l.id} className="border-b border-[#efeded] last:border-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full mr-2 ${
                        l.status === 'success' ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#fbe4e4] text-[#8a1f1f]'
                      }`}
                    >
                      {l.status}
                    </span>
                    <span className="text-[#3f4945]">{l.institution_code} · {l.masked_account}</span>
                    {l.returned_account_name && <span className="text-[#707975] ml-2">— {l.returned_account_name}</span>}
                  </div>
                  <span className="text-xs text-[#707975]">{new Date(l.performed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
                <p className="text-xs text-[#707975] mt-0.5">
                  By {l.performed_by} ·{' '}
                  {l.name_match_confirmed
                    ? `name match confirmed by ${l.name_match_reviewed_by ?? '—'}`
                    : l.name_match_reviewed_by
                      ? `reviewed as not matching by ${l.name_match_reviewed_by}`
                      : 'not yet reviewed'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
