'use client';

import { useState } from 'react';
import { recordConsent } from '@/app/admin/(protected)/merchant-operations/kyc/[merchantId]/actions';
import type { MerchantDataProcessingConsent } from '@/data/merchantOperations';

const CONSENT_TEXT_VERSION = 'privacy-2026-07';

export default function ConsentPanel({
  merchantId,
  consents,
  canManage,
}: {
  merchantId: string;
  consents: MerchantDataProcessingConsent[];
  canManage: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = consents[0];

  const handleRecord = async (given: boolean) => {
    setSubmitting(true);
    setError(null);
    const result = await recordConsent(merchantId, given, CONSENT_TEXT_VERSION);
    setSubmitting(false);
    if (!result.success) setError(result.message ?? 'Failed to record consent.');
  };

  return (
    <div>
      <p className="text-sm text-[#1b1c1c] mb-3">
        Current status:{' '}
        {latest ? (
          <span className={latest.consent_given ? 'text-[#1b7a3d] font-medium' : 'text-[#8a1f1f] font-medium'}>
            {latest.consent_given ? 'Consent given' : 'Consent withdrawn'}
          </span>
        ) : (
          <span className="text-[#707975]">Not yet recorded</span>
        )}
      </p>

      {canManage && (
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => handleRecord(true)}
            disabled={submitting}
            className="text-xs font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            Record Consent Given
          </button>
          <button
            type="button"
            onClick={() => handleRecord(false)}
            disabled={submitting}
            className="text-xs font-medium text-[#8a1f1f] border border-[#8a1f1f] px-4 py-2 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60"
          >
            Record Consent Withdrawn
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-700 mb-3">{error}</p>}

      {consents.length > 0 && (
        <ul className="text-xs text-[#707975] space-y-1">
          {consents.map((c) => (
            <li key={c.id}>
              {c.consent_given ? 'Given' : 'Withdrawn'} ({c.consent_text_version}) by {c.recorded_by} on{' '}
              {new Date(c.recorded_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
