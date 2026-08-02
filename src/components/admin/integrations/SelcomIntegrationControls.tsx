'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setIntegrationEnabled, requestProductionActivation } from '@/app/admin/(protected)/settings/integrations/selcom/actions';

// Only ever rendered once page.tsx has already confirmed both
// integrations.selcom.manage AND a fresh SELCOM_INTEGRATION_REAUTH_PURPOSE
// re-authentication (see SelcomReauthPrompt) — so neither action here needs
// its own password field. Both server actions independently re-check
// permission + reauth anyway (defense in depth), matching the rest of this
// codebase's money/config-consequential actions.
export default function SelcomIntegrationControls({
  integrationEnabled,
  productionActivationStatus,
}: {
  integrationEnabled: boolean;
  productionActivationStatus: 'not_requested' | 'requested';
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showActivationForm, setShowActivationForm] = useState(false);
  const [reason, setReason] = useState('');

  async function handleToggle() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await setIntegrationEnabled(!integrationEnabled);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to update the integration state.');
      return;
    }
    router.refresh();
  }

  async function handleRequestActivation() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await requestProductionActivation(reason);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to submit the production activation request.');
      return;
    }
    setMessage(result.message ?? 'Request submitted.');
    setShowActivationForm(false);
    setReason('');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      {message && <p className="text-sm text-[#1b7a3d] bg-green-50 border border-green-200 px-4 py-3">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleToggle}
          className={`text-sm font-medium px-4 py-2 transition-colors disabled:opacity-60 ${
            integrationEnabled
              ? 'text-[#8a1f1f] border border-[#8a1f1f] hover:bg-[#8a1f1f] hover:text-white'
              : 'text-white bg-[#1b7a3d] hover:bg-[#166030]'
          }`}
        >
          {integrationEnabled ? 'Disable Integration' : 'Enable Integration'}
        </button>

        {productionActivationStatus === 'not_requested' && (
          <button
            type="button"
            onClick={() => setShowActivationForm((v) => !v)}
            className="text-sm font-medium text-[#6b21a8] border border-[#6b21a8] px-4 py-2 hover:bg-[#6b21a8] hover:text-white transition-colors"
          >
            Request Production Activation
          </button>
        )}
        {productionActivationStatus === 'requested' && (
          <span className="text-sm font-medium text-[#8a5a00] border border-[#8a5a00] px-4 py-2">
            Production activation requested — pending review
          </span>
        )}
      </div>

      {showActivationForm && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">
              Reason for requesting production activation (required)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={handleRequestActivation}
            className="text-sm font-medium text-white bg-[#6b21a8] px-4 py-2 hover:bg-[#581c87] transition-colors disabled:opacity-60"
          >
            Submit Request
          </button>
        </div>
      )}
    </div>
  );
}
