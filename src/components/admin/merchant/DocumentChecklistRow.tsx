'use client';

import { useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import {
  requestDocument,
  updateChecklistStatus,
  uploadKycDocument,
  getKycDocumentSignedUrl,
  deleteKycDocumentFile,
  updateMalwareScanStatus,
} from '@/app/admin/(protected)/merchant-operations/kyc/[merchantId]/actions';
import {
  MERCHANT_DOCUMENT_STATUSES,
  MERCHANT_DOCUMENT_STATUS_COLORS,
  MERCHANT_MALWARE_SCAN_STATUSES,
  IDENTITY_DOCUMENT_TYPE,
  type MerchantDocument,
  type MerchantDocumentFile,
} from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

const MALWARE_SCAN_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  clean: 'text-[#1b7a3d]',
  flagged: 'text-[#8a1f1f]',
  skipped: 'text-[#707975]',
};

export default function DocumentChecklistRow({
  merchantId,
  documentType,
  label,
  checklistRow,
  currentFile,
  canManage,
  canView,
  canViewIdentity,
  isMetadataOnly,
}: {
  merchantId: string;
  documentType: string;
  label: string;
  checklistRow: MerchantDocument | undefined;
  currentFile: MerchantDocumentFile | undefined;
  canManage: boolean;
  canView: boolean;
  canViewIdentity: boolean;
  isMetadataOnly: boolean;
}) {
  const [status, setStatus] = useState(checklistRow?.status ?? 'not_requested');
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIdentity = documentType === IDENTITY_DOCUMENT_TYPE;
  const canOpenFile = canView && (!isIdentity || canViewIdentity);

  const handleRequest = async () => {
    setPending(true);
    setError(null);
    const result = await requestDocument(merchantId, documentType);
    setPending(false);
    if (result.success) setStatus('requested');
    else setError(result.message ?? 'Failed to request document.');
  };

  const handleStatusChange = async (next: string) => {
    const previous = status;
    setStatus(next);
    setPending(true);
    setError(null);
    const result = await updateChecklistStatus(merchantId, documentType, next);
    setPending(false);
    if (!result.success) {
      setStatus(previous);
      setError(result.message ?? 'Failed to update status.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    const result = await uploadKycDocument(merchantId, documentType, formData);
    setUploading(false);
    if (result.success) {
      setStatus('uploaded');
    } else {
      setError(result.message ?? 'Failed to upload file.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleView = async () => {
    setPending(true);
    setError(null);
    const result = await getKycDocumentSignedUrl(currentFile!.id);
    setPending(false);
    if (result.success && result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } else {
      setError(result.message ?? 'Failed to open document.');
    }
  };

  const handleDelete = async () => {
    const reason = window.prompt('Reason for deleting this document (required):');
    if (!reason || !reason.trim()) return;
    setPending(true);
    setError(null);
    const result = await deleteKycDocumentFile(currentFile!.id, reason);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to delete document.');
    }
  };

  const handleMalwareScanChange = async (next: string) => {
    setPending(true);
    setError(null);
    const result = await updateMalwareScanStatus(currentFile!.id, next);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to update scan status.');
  };

  return (
    <li className="py-4 flex flex-col gap-2 border-b border-[#efeded] last:border-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="text-sm font-medium text-[#1b1c1c]">{label}</span>
          {isIdentity && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#8a1f1f]">Identity Document</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_DOCUMENT_STATUS_COLORS[status] ?? ''}`}>
            {labelFor(MERCHANT_DOCUMENT_STATUSES, status)}
          </span>
          {canManage && (
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={pending}
              className="border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none"
            >
              {MERCHANT_DOCUMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs text-[#707975]">
        {currentFile ? (
          <>
            <span className="text-[#3f4945]">
              {currentFile.file_name} (v{currentFile.version_number}, {(currentFile.file_size_bytes / 1024).toFixed(0)} KB)
            </span>
            <span>Uploaded by {currentFile.uploaded_by}</span>
            {isMetadataOnly && !canOpenFile && <span className="italic">Metadata only — no file access</span>}
            {canOpenFile && (
              <button type="button" onClick={handleView} disabled={pending} className="inline-flex items-center gap-1 text-[#00342b] font-medium hover:underline disabled:opacity-60">
                <Download size={12} /> View / Download
              </button>
            )}
            {canManage && (
              <button type="button" onClick={handleDelete} disabled={pending} className="inline-flex items-center gap-1 text-[#8a1f1f] font-medium hover:underline disabled:opacity-60">
                <Trash2 size={12} /> Delete
              </button>
            )}
            {canManage && (
              <label className="inline-flex items-center gap-1">
                Scan:
                <select
                  value={currentFile.malware_scan_status}
                  onChange={(e) => handleMalwareScanChange(e.target.value)}
                  disabled={pending}
                  className={`border border-[#bfc9c4] px-1.5 py-1 text-xs focus:border-[#00342b] focus:outline-none ${MALWARE_SCAN_COLORS[currentFile.malware_scan_status] ?? ''}`}
                >
                  {MERCHANT_MALWARE_SCAN_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            )}
          </>
        ) : (
          <span className="italic">No file uploaded yet.</span>
        )}
      </div>

      {canManage && (!isIdentity || canViewIdentity) && (
        <div className="flex items-center gap-3">
          {status === 'not_requested' && (
            <button type="button" onClick={handleRequest} disabled={pending} className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60">
              Request
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#00342b] px-3 py-1.5 hover:bg-[#004d40] transition-colors cursor-pointer disabled:opacity-60">
            <Upload size={12} /> {currentFile ? 'Replace' : 'Upload'}
            <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleFileChange} disabled={uploading} className="hidden" />
          </label>
          {uploading && <span className="text-xs text-[#707975]">Uploading…</span>}
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
    </li>
  );
}
