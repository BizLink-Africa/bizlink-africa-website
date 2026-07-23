'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateContractStatus } from '@/app/admin/(protected)/contracts/actions';
import type { ContractStatus } from '@/data/contracts';

const NEXT_ACTIONS: Partial<Record<ContractStatus, { label: string; target: ContractStatus; confirm?: string; style: 'primary' | 'danger' }[]>> = {
  draft: [
    { label: 'Submit for Review', target: 'under_review', style: 'primary' },
    { label: 'Cancel', target: 'cancelled', confirm: 'Cancel this contract?', style: 'danger' },
  ],
  under_review: [
    { label: 'Submit for Compliance Review', target: 'pending_compliance_review', style: 'primary' },
    { label: 'Cancel', target: 'cancelled', confirm: 'Cancel this contract?', style: 'danger' },
  ],
  pending_compliance_review: [
    { label: 'Mark Compliance Reviewed', target: 'pending_ceo_approval', confirm: 'Confirm this contract passed compliance review?', style: 'primary' },
  ],
  pending_ceo_approval: [
    { label: 'Approve', target: 'approved', confirm: 'Approve this contract?', style: 'primary' },
    { label: 'Return for Changes', target: 'draft', confirm: 'Send this contract back to draft?', style: 'danger' },
  ],
  approved: [
    { label: 'Mark Sent to Client', target: 'sent_to_client', style: 'primary' },
  ],
  sent_to_client: [
    { label: 'Mark Awaiting Signature', target: 'awaiting_signature', style: 'primary' },
  ],
  awaiting_signature: [
    { label: 'Mark Signed', target: 'signed', confirm: 'Confirm the signed contract has been uploaded and mark this as signed?', style: 'primary' },
  ],
  signed: [
    { label: 'Activate Contract', target: 'active', style: 'primary' },
  ],
  active: [
    { label: 'Renew', target: 'renewed', confirm: 'Mark this contract as renewed?', style: 'primary' },
    { label: 'Terminate', target: 'terminated', confirm: 'Terminate this contract? This should only be done for a real termination.', style: 'danger' },
  ],
};

export default function ContractActionButtons({ id, status }: { id: string; status: ContractStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runStatusChange = async (target: ContractStatus, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    const result = await updateContractStatus(id, target);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to update status.');
    else router.refresh();
  };

  const actions = NEXT_ACTIONS[status] ?? [];

  if (actions.length === 0) {
    return <p className="text-sm text-[#707975]">No further status actions available for this contract.</p>;
  }

  return (
    <div>
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
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-2">{error}</p>}
    </div>
  );
}
