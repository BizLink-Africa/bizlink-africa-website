'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { reauthenticateForBeneficiaries } from '@/app/admin/(protected)/merchant-operations/beneficiaries/reauth-actions';

export default function ReauthPrompt() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await reauthenticateForBeneficiaries(password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.message ?? 'Re-authentication failed.');
      return;
    }
    setPassword('');
    router.refresh();
  };

  return (
    <div className="max-w-sm mx-auto py-16 text-center">
      <div className="w-12 h-12 bg-[#e0f2ee] rounded-full flex items-center justify-center mx-auto mb-4">
        <ShieldCheck size={22} className="text-[#00342b]" />
      </div>
      <h1 className="font-bold text-xl text-[#00342b] mb-2">Confirm It&apos;s You</h1>
      <p className="text-sm text-[#707975] mb-6">
        Settlement beneficiary details are sensitive. Re-enter your password to continue — this expires after 10 minutes.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          required
          className="w-full border border-[#bfc9c4] px-3 py-2.5 text-sm focus:border-[#00342b] focus:outline-none"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-[#00342b] text-white py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Verifying…' : 'Confirm'}
        </button>
      </form>
    </div>
  );
}
