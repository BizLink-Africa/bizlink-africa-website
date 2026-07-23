'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProformaStatus, convertProformaToInvoice } from '@/app/admin/(protected)/finance/proformas/actions';
import type { ProformaStatus } from '@/data/finance';

const NEXT_ACTIONS: Partial<Record<ProformaStatus, { label: string; target: ProformaStatus; confirm?: string; style: 'primary' | 'danger' }[]>> = {
  draft: [
    { label: 'Submit for Approval', target: 'pending_approval', style: 'primary' },
    { label: 'Cancel', target: 'cancelled', confirm: 'Cancel this proforma invoice?', style: 'danger' },
  ],
  pending_approval: [
    { label: 'Approve', target: 'approved', confirm: 'Approve this proforma invoice?', style: 'primary' },
    { label: 'Reject', target: 'rejected', confirm: 'Reject this proforma invoice?', style: 'danger' },
  ],
  approved: [
    { label: 'Mark Sent to Client', target: 'sent', style: 'primary' },
    { label: 'Cancel', target: 'cancelled', confirm: 'Cancel this proforma invoice?', style: 'danger' },
  ],
  sent: [
    { label: 'Mark Accepted', target: 'accepted', style: 'primary' },
    { label: 'Reject', target: 'rejected', confirm: 'Mark this proforma invoice as rejected?', style: 'danger' },
  ],
};

export default function ProformaActionButtons({ id, status, alreadyConverted }: { id: string; status: ProformaStatus; alreadyConverted: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runStatusChange = async (target: ProformaStatus, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    const result = await updateProformaStatus(id, target);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to update status.');
    else router.refresh();
  };

  const runConvert = async () => {
    if (!window.confirm('Convert this proforma invoice into an official invoice? This cannot be undone.')) return;
    setPending(true);
    setError(null);
    const result = await convertProformaToInvoice(id);
    setPending(false);
    if (!result.success) setError(result.message ?? 'Failed to convert.');
    else if (result.invoiceId) router.push(`/admin/finance/invoices/${result.invoiceId}`);
  };

  const actions = NEXT_ACTIONS[status] ?? [];
  const canConvert = status === 'accepted' && !alreadyConverted;

  if (actions.length === 0 && !canConvert) {
    return <p className="text-sm text-[#707975]">No further actions available for this status.</p>;
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
        {canConvert && (
          <button
            type="button"
            disabled={pending}
            onClick={runConvert}
            className="text-sm font-medium px-4 py-2 bg-[#00342b] text-white border border-[#00342b] hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            {pending ? 'Converting...' : 'Convert to Invoice'}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-2">{error}</p>}
    </div>
  );
}
