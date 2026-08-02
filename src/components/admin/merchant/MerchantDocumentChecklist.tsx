'use client';

import { useState, useTransition } from 'react';
import { updateMerchantDocumentStatus } from '@/app/admin/(protected)/merchant-operations/actions';
import { MERCHANT_DOCUMENT_TYPES, MERCHANT_DOCUMENT_STATUSES, MERCHANT_DOCUMENT_STATUS_COLORS, type MerchantDocument } from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export default function MerchantDocumentChecklist({
  merchantId,
  documents,
  canManage,
}: {
  merchantId: string;
  documents: MerchantDocument[];
  canManage: boolean;
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(MERCHANT_DOCUMENT_TYPES.map((t) => [t.value, documents.find((d) => d.document_type === t.value)?.status ?? 'pending']))
  );
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleChange = (documentType: string, status: string) => {
    const previous = statuses[documentType];
    setStatuses((prev) => ({ ...prev, [documentType]: status }));
    setPendingType(documentType);
    setError(null);

    startTransition(async () => {
      const result = await updateMerchantDocumentStatus(merchantId, documentType, status);
      setPendingType(null);
      if (!result.success) {
        setStatuses((prev) => ({ ...prev, [documentType]: previous }));
        setError(result.message ?? 'Failed to update document status.');
      }
    });
  };

  return (
    <div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mb-4">{error}</p>}
      <ul className="divide-y divide-[#efeded]">
        {MERCHANT_DOCUMENT_TYPES.map((docType) => (
          <li key={docType.value} className="py-3 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-[#1b1c1c]">{docType.label}</span>
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_DOCUMENT_STATUS_COLORS[statuses[docType.value]] ?? ''}`}>
                {labelFor(MERCHANT_DOCUMENT_STATUSES, statuses[docType.value])}
              </span>
              {canManage && (
                <select
                  value={statuses[docType.value]}
                  onChange={(e) => handleChange(docType.value, e.target.value)}
                  disabled={pendingType === docType.value}
                  className="border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none"
                >
                  {MERCHANT_DOCUMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
