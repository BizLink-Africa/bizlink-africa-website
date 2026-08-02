'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { reauthenticateForSelcomIntegration } from '@/app/admin/(protected)/settings/integrations/selcom/reauth-actions';

// Gates ONLY the manage-tier controls section of the Selcom integration
// page (enable/disable, request production activation) — not the whole
// page, since view-only roles (Finance, Technical Admin) never trigger
// this at all. Same component shape as PayoutReauthPrompt, scoped to a
// different purpose (SELCOM_INTEGRATION_REAUTH_PURPOSE).
export default function SelcomReauthPrompt() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await reauthenticateForSelcomIntegration(password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Re-authentication failed.');
      return;
    }
    setPassword('');
    router.refresh();
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-[#e0f2ee] rounded-full flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-[#00342b]" />
        </div>
        <div>
          <h3 className="font-semibold text-[#00342b]">Confirm It&apos;s You</h3>
          <p className="text-xs text-[#707975]">
            Changing integration configuration requires re-entering your password — this expires after 10 minutes.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            required
            className="w-full border border-[#bfc9c4] px-3 py-2.5 text-sm focus:border-[#00342b] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 bg-[#00342b] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Verifying…' : 'Confirm'}
        </button>
      </form>
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
