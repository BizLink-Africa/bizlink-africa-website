import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import HoldReleaseActions from '@/components/admin/chargebacks/HoldReleaseActions';
import { formatMoney } from '@/lib/collections/money';
import { SETTLEMENT_HOLD_STATUS_COLORS, SETTLEMENT_HOLD_EVENT_LABELS, type SettlementHold, type SettlementHoldEvent } from '@/data/holds';

export const dynamic = 'force-dynamic';

export default async function SettlementHoldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('holds.view');
  } catch {
    return <AccessDenied requiredPermission="holds.view" />;
  }
  let canManage = true;
  try {
    await requirePermission('holds.manage');
  } catch {
    canManage = false;
  }
  let canApprove = true;
  try {
    await requirePermission('holds.approve');
  } catch {
    canApprove = false;
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: hold } = await supabase.from('settlement_holds').select('*').eq('id', id).maybeSingle();
  if (!hold) notFound();
  const h = hold as SettlementHold;

  const [{ data: merchant }, { data: txn }, { data: batch }, { data: eventRows }] = await Promise.all([
    supabase.from('merchants').select('business_name').eq('id', h.merchant_id).maybeSingle(),
    h.transaction_id ? supabase.from('collection_transactions').select('provider_transaction_reference').eq('id', h.transaction_id).maybeSingle() : Promise.resolve({ data: null }),
    h.batch_id ? supabase.from('settlement_batches').select('batch_number').eq('id', h.batch_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('settlement_hold_events').select('*').eq('hold_id', id).order('performed_at', { ascending: true }),
  ]);
  const events = (eventRows ?? []) as SettlementHoldEvent[];

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href="/admin/chargebacks/holds" className="text-xs font-medium text-[#00342b] hover:underline">← Hold Queue</Link>
      </div>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{merchant?.business_name ?? h.merchant_id}</h1>
          <p className="text-sm text-[#707975] mt-1">{h.transaction_id ? `Transaction hold: ${txn?.provider_transaction_reference}` : 'Blanket hold on all settlements'}</p>
        </div>
        <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${SETTLEMENT_HOLD_STATUS_COLORS[h.status]}`}>
          {h.status === 'active' ? 'Active' : 'Released'}
        </span>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4 mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-0.5">Hold Amount</dt><dd className="text-[#1b1c1c]">{h.hold_amount !== '0.00' ? formatMoney(h.hold_amount, 'TZS') : 'Blanket (no specific amount)'}</dd></div>
          <div><dt className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-0.5">Created By</dt><dd className="text-[#1b1c1c]">{h.created_by}</dd></div>
          <div><dt className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-0.5">Placed At</dt><dd className="text-[#1b1c1c]">{new Date(h.placed_at).toLocaleString('en-GB')}</dd></div>
          <div><dt className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-0.5">Expires At</dt><dd className="text-[#1b1c1c]">{h.expires_at ? new Date(h.expires_at).toLocaleString('en-GB') : '—'}</dd></div>
          {batch?.batch_number && <div><dt className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-0.5">Related Batch</dt><dd><Link href={`/admin/settlement/${h.batch_id}`} className="text-[#00342b] hover:underline">{batch.batch_number}</Link></dd></div>}
        </dl>
        <p className="text-sm text-[#3f4945] border-t border-[#efeded] pt-3">{h.hold_reason}</p>
        {h.released_at && (
          <p className="text-xs text-[#707975]">Released by {h.approved_by} on {new Date(h.released_at).toLocaleString('en-GB')} — {h.release_reason}</p>
        )}
      </div>

      <div className="mb-6">
        <HoldReleaseActions holdId={h.id} status={h.status} releaseRequestedBy={h.release_requested_by} canManage={canManage} canApprove={canApprove} />
      </div>

      <h2 className="font-semibold text-[#00342b] mb-3">Hold History</h2>
      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
        {events.map((e) => (
          <div key={e.id} className="p-4">
            <p className="text-sm font-medium text-[#1b1c1c]">{SETTLEMENT_HOLD_EVENT_LABELS[e.event_type] ?? e.event_type}</p>
            <p className="text-xs text-[#707975] mt-0.5">{e.performed_by} · {new Date(e.performed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            {e.notes && <p className="text-xs text-[#3f4945] mt-1 italic">&quot;{e.notes}&quot;</p>}
          </div>
        ))}
        {events.length === 0 && <p className="p-4 text-center text-sm text-[#707975]">No events recorded yet.</p>}
      </div>
    </div>
  );
}
