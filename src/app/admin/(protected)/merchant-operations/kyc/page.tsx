import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import RecordKycForm from '@/components/admin/merchant/RecordKycForm';
import { MERCHANT_KYC_STAGES, MERCHANT_KYC_PARTNER_DECISIONS, type MerchantKycReview } from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

const DECISION_COLORS: Record<string, string> = {
  pending: 'bg-[#eeeeee] text-[#3f4945]',
  approved: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
  additional_information_required: 'bg-[#fef3e0] text-[#8a5a00]',
};

export default async function KycCoordinationPage() {
  let canManage = true;
  try {
    await requirePermission('merchant_kyc.view');
  } catch {
    return <AccessDenied requiredPermission="merchant_kyc.view" />;
  }
  try {
    await requirePermission('merchant_kyc.manage');
  } catch {
    canManage = false;
  }

  let canViewDocuments = true;
  let isMetadataOnlyDocuments = false;
  try {
    await requirePermission('merchant_kyc_documents.view');
  } catch {
    canViewDocuments = false;
    try {
      await requirePermission('merchant_kyc_documents.metadata_view');
      isMetadataOnlyDocuments = true;
    } catch {
      isMetadataOnlyDocuments = false;
    }
  }

  const supabase = await createClient();
  const [{ data: reviews, error }, { data: merchantRows }] = await Promise.all([
    supabase.from('merchant_kyc_reviews').select('*').order('recorded_at', { ascending: false }).limit(200),
    supabase.from('merchants').select('id, business_name').order('business_name'),
  ]);

  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));
  const reviewRows = (reviews ?? []) as MerchantKycReview[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">KYC Coordination</h1>
          <p className="text-sm text-[#707975] mt-1">
            BizLink coordinates document collection and KYC submission; final approval is always recorded as received from the approved payment infrastructure partner.
          </p>
        </div>
        {canManage && <RecordKycForm merchants={merchantRows ?? []} />}
      </div>

      {(canViewDocuments || isMetadataOnlyDocuments) && (
        <div className="mb-6 bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-1">Document Checklists</h2>
          <p className="text-xs text-[#707975] mb-4">
            Open a merchant to manage their secure document checklist, consent record, and file access.
          </p>
          <ul className="flex flex-wrap gap-2">
            {(merchantRows ?? []).map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/merchant-operations/kyc/${m.id}`}
                  className="inline-block text-xs font-medium text-[#00342b] border border-[#bfc9c4] px-3 py-2 hover:border-[#00342b] transition-colors"
                >
                  {m.business_name}
                </Link>
              </li>
            ))}
            {(merchantRows ?? []).length === 0 && <p className="text-sm text-[#707975]">No merchants yet.</p>}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load KYC coordination records: {error.message}
        </p>
      )}

      <div className="mt-4 bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Partner Decision</th>
              <th className="px-4 py-3">Partner Reference</th>
              <th className="px-4 py-3">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {reviewRows.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3">
                  <Link href={`/admin/merchant-operations/profiles/${r.merchant_id}`} className="font-medium text-[#00342b] hover:underline">
                    {merchantNameById.get(r.merchant_id) ?? 'Unknown merchant'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(MERCHANT_KYC_STAGES, r.stage)}</td>
                <td className="px-4 py-3">
                  {r.partner_decision ? (
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${DECISION_COLORS[r.partner_decision] ?? ''}`}>
                      {labelFor(MERCHANT_KYC_PARTNER_DECISIONS, r.partner_decision)}
                    </span>
                  ) : (
                    <span className="text-[#707975]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{r.partner_reference ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">
                  <div>{r.recorded_by}</div>
                  <div className="text-xs text-[#707975]">{new Date(r.recorded_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                </td>
              </tr>
            ))}
            {reviewRows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No KYC coordination records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
