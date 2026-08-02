'use client';

import { useState } from 'react';

export interface SelcomCallbackEventEntry {
  id: string;
  received_at: string;
  reference_id: string;
  raw_status: string;
  masked_sender_account_number: string | null;
  masked_recipient_account_number: string | null;
  payout_id: string | null;
  outcome: string;
  rejection_reason: string | null;
  dry_run: boolean;
}

const OUTCOME_LABELS: Record<string, string> = {
  processed: 'Processed',
  duplicate: 'Duplicate (already resolved)',
  reference_not_found: 'Unknown reference — security review',
  unexpected_status: 'Unexpected status',
  amount_mismatch: 'Amount mismatch',
  destination_mismatch: 'Destination mismatch',
  invalid_state: 'Invalid payout state',
  dry_run_ok: 'Dry run — would process',
};

const OUTCOME_COLORS: Record<string, string> = {
  processed: 'bg-green-50 text-[#1b7a3d]',
  duplicate: 'bg-[#f5f3f3] text-[#707975]',
  reference_not_found: 'bg-red-50 text-red-700',
  unexpected_status: 'bg-red-50 text-red-700',
  amount_mismatch: 'bg-red-50 text-red-700',
  destination_mismatch: 'bg-red-50 text-red-700',
  invalid_state: 'bg-orange-50 text-[#8a5a00]',
  dry_run_ok: 'bg-blue-50 text-blue-700',
};

// Every callback attempt this app has ever received or simulated —
// "callback-event monitoring" for the Selcom integration settings page.
// Pre-fetched server-side (page.tsx, gated by payouts.view via the
// selcom_callback_events RLS policy) and passed in.
export default function SelcomCallbackEventsPanel({ events }: { events: SelcomCallbackEventEntry[] }) {
  const [open, setOpen] = useState(false);
  const reviewQueueCount = events.filter((e) => e.outcome === 'reference_not_found' && !e.dry_run).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
      >
        {open ? 'Hide Callback Events' : 'View Callback Events'}
        {reviewQueueCount > 0 && (
          <span className="ml-2 inline-block px-1.5 py-0.5 text-xs font-semibold rounded-full bg-red-600 text-white">
            {reviewQueueCount} unrecognised
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 bg-white border border-[#bfc9c4] divide-y divide-[#efeded] max-h-[480px] overflow-y-auto">
          {events.map((e) => (
            <div key={e.id} className="p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#1b1c1c] font-mono">
                  {e.reference_id}
                  {e.dry_run && <span className="ml-2 text-xs font-sans font-normal text-[#707975]">(dry run)</span>}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${OUTCOME_COLORS[e.outcome] ?? 'bg-[#f5f3f3] text-[#707975]'}`}>
                  {OUTCOME_LABELS[e.outcome] ?? e.outcome}
                </span>
              </div>
              <p className="text-xs text-[#707975] mt-0.5">
                {new Date(e.received_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                {' · Selcom status: '}
                {e.raw_status}
              </p>
              {/* Masked only, per "mask callback account values in the
                  dashboard" — never the raw sender/recipient account. */}
              {(e.masked_sender_account_number || e.masked_recipient_account_number) && (
                <p className="text-xs text-[#3f4945] mt-1">
                  {e.masked_sender_account_number && <>Sender: {e.masked_sender_account_number} </>}
                  {e.masked_recipient_account_number && <>Recipient: {e.masked_recipient_account_number}</>}
                </p>
              )}
              {e.rejection_reason && <p className="text-xs text-red-700 mt-1 italic">&quot;{e.rejection_reason}&quot;</p>}
            </div>
          ))}
          {events.length === 0 && <p className="p-4 text-center text-sm text-[#707975]">No callback events recorded yet.</p>}
        </div>
      )}
    </div>
  );
}
