'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateOpportunityStage } from '@/app/admin/(protected)/crm/opportunities/actions';
import type { OpportunityStage } from '@/data/crm';

const NEXT_ACTIONS: Partial<Record<OpportunityStage, { label: string; target: OpportunityStage; confirm?: string; style: 'primary' | 'danger' }[]>> = {
  identified: [{ label: 'Qualify', target: 'qualified', style: 'primary' }],
  qualified: [{ label: 'Propose Solution', target: 'solution_proposed', style: 'primary' }],
  solution_proposed: [{ label: 'Send Proposal', target: 'proposal_sent', style: 'primary' }],
  proposal_sent: [{ label: 'Enter Negotiation', target: 'negotiation', style: 'primary' }],
  negotiation: [
    { label: 'Verbal Agreement', target: 'verbal_agreement', style: 'primary' },
    { label: 'Mark Lost', target: 'lost', confirm: 'Mark this opportunity as lost?', style: 'danger' },
  ],
  verbal_agreement: [
    { label: 'Mark Won', target: 'won', confirm: 'Mark this opportunity as won?', style: 'primary' },
    { label: 'Mark Lost', target: 'lost', confirm: 'Mark this opportunity as lost?', style: 'danger' },
  ],
  on_hold: [{ label: 'Reactivate (Identified)', target: 'identified', style: 'primary' }],
};

export default function OpportunityActionButtons({ id, stage }: { id: string; stage: OpportunityStage }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runStageChange = async (target: OpportunityStage, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    const result = await updateOpportunityStage(id, target);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to update stage.');
    else router.refresh();
  };

  const actions = NEXT_ACTIONS[stage] ?? [];
  const canHold = stage !== 'won' && stage !== 'lost' && stage !== 'on_hold';

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={pending}
            onClick={() => runStageChange(action.target, action.confirm)}
            className={`text-sm font-medium px-4 py-2 border transition-colors disabled:opacity-60 ${
              action.style === 'danger'
                ? 'border-red-200 text-red-700 hover:bg-red-50'
                : 'bg-[#00342b] text-white border-[#00342b] hover:bg-[#004d40]'
            }`}
          >
            {pending ? 'Saving...' : action.label}
          </button>
        ))}
        {canHold && (
          <button
            type="button"
            disabled={pending}
            onClick={() => runStageChange('on_hold', 'Put this opportunity on hold?')}
            className="text-sm font-medium px-4 py-2 border border-[#bfc9c4] text-[#707975] hover:bg-[#f5f3f3] transition-colors disabled:opacity-60"
          >
            Put On Hold
          </button>
        )}
        {actions.length === 0 && !canHold && <p className="text-sm text-[#707975]">No further stage actions available.</p>}
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-2">{error}</p>}
    </div>
  );
}
