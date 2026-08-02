import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import DocumentChecklistRow from '@/components/admin/merchant/DocumentChecklistRow';
import ConsentPanel from '@/components/admin/merchant/ConsentPanel';
import { maskCredential } from '@/lib/security/mask';
import {
  MERCHANT_DOCUMENT_TYPES,
  type MerchantDocument,
  type MerchantDocumentFile,
  type MerchantDataProcessingConsent,
} from '@/data/merchantOperations';

export const dynamic = 'force-dynamic';

export default async function MerchantKycWorkspacePage({ params }: { params: Promise<{ merchantId: string }> }) {
  let canView = false;
  let isMetadataOnly = false;
  try {
    await requirePermission('merchant_kyc_documents.view');
    canView = true;
  } catch {
    try {
      await requirePermission('merchant_kyc_documents.metadata_view');
      isMetadataOnly = true;
    } catch {
      return <AccessDenied requiredPermission="merchant_kyc_documents.view" />;
    }
  }
  let canManage = true;
  try {
    await requirePermission('merchant_kyc_documents.manage');
  } catch {
    canManage = false;
  }
  let canViewIdentity = true;
  try {
    await requirePermission('merchant_kyc_identity_documents.view');
  } catch {
    canViewIdentity = false;
  }

  const { merchantId } = await params;
  const supabase = await createClient();

  const [{ data: merchant, error }, { data: checklistRows }, { data: fileRows }, { data: consentRows }] = await Promise.all([
    supabase.from('merchants').select('id, business_name, tin').eq('id', merchantId).single(),
    supabase.from('merchant_documents').select('*').eq('merchant_id', merchantId),
    supabase.from('merchant_document_files').select('*').eq('merchant_id', merchantId).eq('is_current', true).is('deleted_at', null),
    supabase.from('merchant_data_processing_consent').select('*').eq('merchant_id', merchantId).order('recorded_at', { ascending: false }),
  ]);

  if (error || !merchant) notFound();

  const checklistByType = new Map((checklistRows ?? []).map((r) => [r.document_type, r as MerchantDocument]));
  const fileByType = new Map((fileRows ?? []).map((r) => [r.document_type, r as MerchantDocumentFile]));
  const consents = (consentRows ?? []) as MerchantDataProcessingConsent[];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/merchant-operations/kyc" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-4">
        <ArrowLeft size={14} /> Back to KYC Coordination
      </Link>

      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">{merchant.business_name}</h1>
        <p className="text-sm text-[#707975] mt-1">TIN: {maskCredential(merchant.tin)}</p>
      </div>

      <div className="mb-6 bg-[#e0f2ee] border border-[#94d3c1] p-4 flex items-start gap-3">
        <ShieldAlert size={18} className="text-[#00342b] mt-0.5 shrink-0" />
        <p className="text-xs text-[#00342b] leading-relaxed">
          BizLink coordinates document collection, internal review, and submission to the approved payment
          infrastructure partner. Final KYC approval is always the partner&apos;s decision, recorded on this
          merchant&apos;s KYC Coordination log — never a decision made in this checklist.
          {isMetadataOnly && ' You have read-only metadata access: file names, sizes, and status only — no file content.'}
        </p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
        <h2 className="font-semibold text-[#00342b] mb-1">Document Checklist</h2>
        <p className="text-xs text-[#707975] mb-4">
          All files are stored in a private bucket. Links are single-use, expire in 60 seconds, and every view,
          upload, replacement, and deletion is recorded in the audit timeline.
        </p>
        <ul>
          {MERCHANT_DOCUMENT_TYPES.map((docType) => (
            <DocumentChecklistRow
              key={docType.value}
              merchantId={merchantId}
              documentType={docType.value}
              label={docType.label}
              checklistRow={checklistByType.get(docType.value)}
              currentFile={fileByType.get(docType.value)}
              canManage={canManage}
              canView={canView}
              canViewIdentity={canViewIdentity}
              isMetadataOnly={isMetadataOnly}
            />
          ))}
        </ul>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-3">Data-Processing Consent</h2>
        <ConsentPanel merchantId={merchantId} consents={consents} canManage={canManage} />
      </div>
    </div>
  );
}
