import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import BatchSummary from '@/components/admin/settlement/BatchSummary';
import DecisionForm from '@/components/admin/settlement/DecisionForm';
import { rejectSettlementBatch } from '@/app/admin/(protected)/settlement/actions';
import type { SettlementBatch } from '@/data/settlement';

export const dynamic = 'force-dynamic';

export default async function SettlementBatchRejectPage({ params }: { params: Promise<{ id: string }> }) {
  let canReject = true;
  try {
    await requirePermission('settlement.review');
  } catch {
    canReject = false;
  }
  if (!canReject) {
    try {
      await requirePermission('settlement.approve');
    } catch {
      return <AccessDenied requiredPermission="settlement.review" />;
    }
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase.from('settlement_batches').select('*').eq('id', id).maybeSingle();
  if (!batch) notFound();
  const typedBatch = batch as SettlementBatch;

  if (!['ready_for_review', 'ready_for_approval'].includes(typedBatch.status)) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-[#707975] bg-white border border-[#bfc9c4] px-4 py-4">
          This batch cannot be rejected from its current status ({typedBatch.status}).{' '}
          <Link href={`/admin/settlement/${id}`} className="text-[#00342b] font-medium hover:underline">Back to batch</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href={`/admin/settlement/${id}`} className="text-xs font-medium text-[#00342b] hover:underline">← {typedBatch.batch_number}</Link>
      </div>
      <h1 className="font-bold text-2xl text-[#00342b] mb-6">Rejection Screen</h1>
      <div className="mb-6"><BatchSummary batch={typedBatch} /></div>
      <DecisionForm
        batchId={id}
        action={rejectSettlementBatch}
        buttonLabel="Confirm Rejection"
        buttonClassName="text-sm font-medium text-white bg-[#8a1f1f] px-5 py-2.5 hover:bg-[#6e1919] transition-colors disabled:opacity-60"
        notesLabel="Rejection Reason (required)"
        notesRequired={true}
        redirectTo={`/admin/settlement/${id}`}
      />
    </div>
  );
}
