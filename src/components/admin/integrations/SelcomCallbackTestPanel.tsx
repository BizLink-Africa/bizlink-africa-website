'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { simulateSelcomCallback } from '@/app/admin/(protected)/settings/integrations/selcom/actions';

export interface TestablePayoutOption {
  id: string;
  payout_reference: string;
  amount: string;
  status: string;
}

// Sandbox callback testing: exercises the real POST /api/integrations/
// selcom/callback/[secret] pipeline against a real sandbox payout, without
// waiting for Selcom's own sandbox to actually deliver one. Dry run (the
// default) calls process_selcom_callback() directly with p_dry_run = true
// — every guard runs, nothing is ever mutated. "Send live" instead POSTs
// to the real route, so a passing run really can mark the selected payout
// Successful — gated by fresh re-authentication server-side.
export default function SelcomCallbackTestPanel({ payouts }: { payouts: TestablePayoutOption[] }) {
  const router = useRouter();
  const [payoutId, setPayoutId] = useState(payouts[0]?.id ?? '');
  const [tamperAmount, setTamperAmount] = useState(false);
  const [tamperReference, setTamperReference] = useState(false);
  const [tamperDestination, setTamperDestination] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ outcome?: string; rejectionReason?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (!payoutId) return;
    if (!dryRun) {
      const confirmed = window.confirm(
        'This sends a real callback to the live endpoint. If every check passes, it will mark the selected sandbox payout as Successful. Continue?'
      );
      if (!confirmed) return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    const res = await simulateSelcomCallback(payoutId, { dryRun, tamperAmount, tamperReference, tamperDestination });
    setPending(false);
    if (!res.success) {
      setError(res.message ?? 'Callback simulation failed.');
      return;
    }
    setResult({ outcome: res.outcome, rejectionReason: res.rejectionReason });
    router.refresh();
  }

  if (payouts.length === 0) {
    return (
      <p className="text-sm text-[#707975]">
        No sandbox payouts in Submitted, Processing, or Unknown status are available to test against right now.
      </p>
    );
  }

  return (
    <div className="bg-white border border-[#bfc9c4] p-4 space-y-3">
      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Sandbox Payout</label>
        <select
          value={payoutId}
          onChange={(e) => setPayoutId(e.target.value)}
          className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none"
        >
          {payouts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.payout_reference} — {p.amount} — {p.status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-[#3f4945]">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={tamperAmount} onChange={(e) => setTamperAmount(e.target.checked)} />
          Simulate wrong amount
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={tamperReference} onChange={(e) => setTamperReference(e.target.checked)} />
          Simulate unknown reference
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={tamperDestination} onChange={(e) => setTamperDestination(e.target.checked)} />
          Simulate wrong destination
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(true)}
          className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
        >
          {pending ? 'Validating…' : 'Dry Run (validate only, never mutates)'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(false)}
          className="text-sm font-medium text-white bg-[#6b21a8] px-4 py-2 hover:bg-[#581c87] transition-colors disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send Live Callback (SANDBOX — can mark payout Successful)'}
        </button>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      {result && (
        <p className={`text-sm px-4 py-3 border ${result.outcome === 'processed' || result.outcome === 'dry_run_ok' ? 'text-[#1b7a3d] bg-green-50 border-green-200' : 'text-[#8a5a00] bg-orange-50 border-orange-200'}`}>
          Outcome: <span className="font-semibold">{result.outcome}</span>
          {result.rejectionReason && <> — {result.rejectionReason}</>}
        </p>
      )}
    </div>
  );
}
