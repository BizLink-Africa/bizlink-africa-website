'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProposalStatus } from '@/app/admin/(protected)/crm/proposals/actions';
import type { ProposalStatus } from '@/data/crm';

const NEXT_ACTIONS: Partial<Record<ProposalStatus, { label: string; target: ProposalStatus; confirm?: string; style: 'primary' | 'danger' }[]>> = {
  draft: [{ label: 'Submit for Approval', target: 'pending_approval', style: 'primary' }],
  pending_approval: [
    { label: 'Approve', target: 'approved', confirm: 'Approve this proposal?', style: 'primary' },
    { label: 'Reject', target: 'rejected', confirm: 'Reject this proposal?', style: 'danger' },
  ],
  approved: [{ label: 'Mark Sent', target: 'sent', style: 'primary' }],
  sent: [
    { label: 'Mark Accepted', target: 'accepted', style: 'primary' },
    { label: 'Mark Rejected', target: 'rejected', confirm: 'Mark this proposal as rejected?', style: 'danger' },
    { label: 'Mark Expired', target: 'expired', confirm: 'Mark this proposal as expired?', style: 'danger' },
  ],
  accepted: [{ label: 'Mark Converted', target: 'converted', confirm: 'Mark this proposal as converted (e.g. into a contract/invoice)?', style: 'primary' }],
};

export default function ProposalActionButtons({ id, status }: { id: string; status: ProposalStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [clientResponse, setClientResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runStatusChange = async (target: ProposalStatus, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    const result = await updateProposalStatus(id, target, clientResponse || undefined);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to update status.');
    else {
      setClientResponse('');
      router.refresh();
    }
  };

  const actions = NEXT_ACTIONS[status] ?? [];

  return (
    <div className="space-y-3">
      {(status === 'sent' || status === 'accepted' || status === 'rejected') && (
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="clientResponse">
            Client Response
          </label>
          <textarea
            id="clientResponse"
            rows={2}
            value={clientResponse}
            onChange={(e) => setClientResponse(e.target.value)}
            placeholder="What did the client say?"
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={pending}
            onClick={() => runStatusChange(action.target, action.confirm)}
            className={`text-sm font-medium px-4 py-2 border transition-colors disabled:opacity-60 ${
              action.style === 'danger'
                ? 'border-red-200 text-red-700 hover:bg-red-50'
                : 'bg-[#00342b] text-white border-[#00342b] hover:bg-[#004d40]'
            }`}
          >
            {pending ? 'Saving...' : action.label}
          </button>
        ))}
        {actions.length === 0 && <p className="text-sm text-[#707975]">No further actions available for this status.</p>}
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
    </div>
  );
}
