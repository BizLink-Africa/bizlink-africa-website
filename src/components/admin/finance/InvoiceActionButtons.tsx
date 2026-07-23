'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateInvoiceStatus } from '@/app/admin/(protected)/finance/invoices/actions';
import type { InvoiceStatus } from '@/data/finance';

const NEXT_ACTIONS: Partial<Record<InvoiceStatus, { label: string; target: InvoiceStatus; confirm?: string; style: 'primary' | 'danger' }[]>> = {
  draft: [
    { label: 'Submit for Approval', target: 'pending_approval', style: 'primary' },
    { label: 'Cancel', target: 'cancelled', confirm: 'Cancel this invoice?', style: 'danger' },
  ],
  pending_approval: [
    { label: 'Approve', target: 'approved', confirm: 'Approve this invoice?', style: 'primary' },
    { label: 'Cancel', target: 'cancelled', confirm: 'Cancel this invoice?', style: 'danger' },
  ],
  approved: [
    { label: 'Issue Invoice', target: 'issued', confirm: 'Issue this invoice to the client?', style: 'primary' },
    { label: 'Cancel', target: 'cancelled', confirm: 'Cancel this invoice?', style: 'danger' },
  ],
};

export default function InvoiceActionButtons({ id, status }: { id: string; status: InvoiceStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runStatusChange = async (target: InvoiceStatus, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    const result = await updateInvoiceStatus(id, target);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to update status.');
    else router.refresh();
  };

  const actions = NEXT_ACTIONS[status] ?? [];

  if (actions.length === 0) {
    return <p className="text-sm text-[#707975]">No further status actions available — use the payment form below to record payments.</p>;
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
