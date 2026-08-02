import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import BatchSummary from '@/components/admin/settlement/BatchSummary';
import DecisionForm from '@/components/admin/settlement/DecisionForm';
import { approveSettlementBatch } from '@/app/admin/(protected)/settlement/actions';
import type { SettlementBatch } from '@/data/settlement';

export const dynamic = 'force-dynamic';

export default async function SettlementBatchApprovePage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('settlement.approve');
  } catch {
    return <AccessDenied requiredPermission="settlement.approve" />;
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase.from('settlement_batches').select('*').eq('id', id).maybeSingle();
  if (!batch) notFound();
  const typedBatch = batch as SettlementBatch;

  if (typedBatch.status !== 'ready_for_approval') {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-[#707975] bg-white border border-[#bfc9c4] px-4 py-4">
          This batch is not currently ready for approval (status: {typedBatch.status}).{' '}
          <Link href={`/admin/settlement/${id}`} className="text-[#00342b] font-medium hover:underline">Back to batch</Link>
        </p>
      </div>
    );
  }

  const isSecondApproval = typedBatch.requires_dual_approval && !!typedBatch.approved_by;

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href={`/admin/settlement/${id}`} className="text-xs font-medium text-[#00342b] hover:underline">← {typedBatch.batch_number}</Link>
      </div>
      <h1 className="font-bold text-2xl text-[#00342b] mb-2">Approval Screen</h1>
      {isSecondApproval && (
        <p className="text-sm text-indigo-800 bg-indigo-50 border border-indigo-200 px-4 py-3 mb-4">
          This is a high-value batch and already has one approval from {typedBatch.approved_by}. Your approval must come from a different person and will be the second, final approval.
        </p>
      )}
      <div className="mb-6"><BatchSummary batch={typedBatch} /></div>
      <DecisionForm
        batchId={id}
        action={approveSettlementBatch}
        buttonLabel={isSecondApproval ? 'Give Second Approval' : 'Approve Batch'}
        buttonClassName="text-sm font-medium text-white bg-[#1b7a3d] px-5 py-2.5 hover:bg-[#166030] transition-colors disabled:opacity-60"
        notesLabel="Approval Notes (optional)"
        notesRequired={false}
        redirectTo={`/admin/settlement/${id}`}
      />
      <p className="text-xs text-[#707975] mt-3">
        Not ready? <Link href={`/admin/settlement/${id}/reject`} className="text-[#8a1f1f] font-medium hover:underline">Go to the Rejection Screen</Link> instead.
      </p>
    </div>
  );
}
