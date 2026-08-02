import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import type { SettlementBatchEvent } from '@/data/settlement';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  prepared: 'Batch Prepared',
  submitted_for_review: 'Submitted for Review',
  reviewed: 'Reviewed',
  rejected: 'Rejected',
  approved_first: 'First Approval',
  approved_second: 'Second Approval',
  compliance_hold_placed: 'Compliance Hold Placed',
  compliance_hold_released: 'Compliance Hold Released',
  emergency_cancelled: 'Emergency Cancelled',
  processing_started: 'Payout Processing Started',
};

export default async function SettlementBatchHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('settlement.view');
  } catch {
    return <AccessDenied requiredPermission="settlement.view" />;
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: batch } = await supabase.from('settlement_batches').select('id, batch_number').eq('id', id).maybeSingle();
  if (!batch) notFound();

  const { data: events, error } = await supabase
    .from('settlement_batch_events')
    .select('*')
    .eq('batch_id', id)
    .order('performed_at', { ascending: true });
  const typedEvents = (events ?? []) as SettlementBatchEvent[];

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href={`/admin/settlement/${id}`} className="text-xs font-medium text-[#00342b] hover:underline">← {batch.batch_number}</Link>
      </div>
      <h1 className="font-bold text-2xl text-[#00342b] mb-6">Batch Audit History</h1>

      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load history: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
        {typedEvents.map((e) => (
          <div key={e.id} className="p-4">
            <p className="text-sm font-medium text-[#1b1c1c]">{EVENT_LABELS[e.event_type] ?? e.event_type}</p>
            <p className="text-xs text-[#707975] mt-0.5">
              {e.performed_by} · {new Date(e.performed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            {e.notes && <p className="text-xs text-[#3f4945] mt-1 italic">&quot;{e.notes}&quot;</p>}
          </div>
        ))}
        {typedEvents.length === 0 && !error && (
          <p className="p-4 text-center text-sm text-[#707975]">No events recorded yet.</p>
        )}
      </div>
    </div>
  );
}
