import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { hasRecentReauth, PAYOUT_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import AccessDenied from '@/components/admin/AccessDenied';
import PayoutReauthPrompt from '@/components/admin/payouts/PayoutReauthPrompt';
import PayoutActions from '@/components/admin/payouts/PayoutActions';
import SandboxBanner from '@/components/admin/payouts/SandboxBanner';
import { formatMoney } from '@/lib/collections/money';
import {
  MERCHANT_PAYOUT_STATUSES,
  MERCHANT_PAYOUT_STATUS_COLORS,
  MERCHANT_PAYOUT_EVENT_LABELS,
  type MerchantPayout,
  type MerchantPayoutEvent,
  type MerchantPayoutStatusCheck,
} from '@/data/payouts';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function MerchantPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('payouts.view');
  } catch {
    return <AccessDenied requiredPermission="payouts.view" />;
  }

  const permissionChecks = await Promise.all(
    ['payouts.manage', 'payouts.approve', 'payouts.submit', 'payouts.hold'].map(async (perm) => {
      try {
        await requirePermission(perm);
        return true;
      } catch {
        return false;
      }
    })
  );
  const [canManage, canApprove, canSubmit, canHold] = permissionChecks;

  // Approving/submitting/reversing real money movement requires a fresh
  // re-authentication — gated at the page level, same pattern as
  // Settlement Beneficiaries.
  if ((canApprove || canSubmit) && !(await hasRecentReauth(PAYOUT_REAUTH_PURPOSE))) {
    return <PayoutReauthPrompt />;
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: payout } = await supabase.from('merchant_payouts').select('*').eq('id', id).maybeSingle();
  if (!payout) notFound();
  const typedPayout = payout as MerchantPayout;

  const [{ data: merchant }, { data: beneficiary }, { data: batch }, { data: events }, { data: statusChecks }] = await Promise.all([
    supabase.from('merchants').select('business_name').eq('id', typedPayout.merchant_id).maybeSingle(),
    typedPayout.beneficiary_id
      ? supabase.from('merchant_settlement_beneficiaries').select('masked_destination_value, bank_or_network_name').eq('id', typedPayout.beneficiary_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('settlement_batches').select('batch_number').eq('id', typedPayout.batch_id).maybeSingle(),
    supabase.from('merchant_payout_events').select('*').eq('payout_id', id).order('performed_at', { ascending: true }),
    supabase.from('merchant_payout_status_checks').select('*').eq('payout_id', id).order('started_at', { ascending: false }).limit(50),
  ]);
  const typedEvents = (events ?? []) as MerchantPayoutEvent[];
  const typedStatusChecks = (statusChecks ?? []) as MerchantPayoutStatusCheck[];

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/admin/payouts" className="text-xs font-medium text-[#00342b] hover:underline">← All Payouts</Link>
      </div>

      <div className="mb-4">
        <SandboxBanner />
      </div>

      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{typedPayout.payout_reference}</h1>
          <p className="text-sm text-[#707975] mt-1">{merchant?.business_name ?? typedPayout.merchant_id}</p>
        </div>
        <span className={`inline-block px-3 py-1.5 text-xs font-medium rounded-full ${MERCHANT_PAYOUT_STATUS_COLORS[typedPayout.status] ?? ''}`}>
          {labelFor(MERCHANT_PAYOUT_STATUSES, typedPayout.status)}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href={`/admin/settlement/${typedPayout.batch_id}`} className="text-[#00342b] font-medium border border-[#bfc9c4] px-3 py-1.5 hover:border-[#00342b]">Settlement Batch{batch?.batch_number ? ` (${batch.batch_number})` : ''}</Link>
        <Link href={`/admin/merchant-operations/profiles/${typedPayout.merchant_id}`} className="text-[#00342b] font-medium border border-[#bfc9c4] px-3 py-1.5 hover:border-[#00342b]">Merchant Statement</Link>
        <a href={`/admin/payouts/${id}/export`} className="text-[#00342b] font-medium border border-[#bfc9c4] px-3 py-1.5 hover:border-[#00342b]">Export Settlement Confirmation</a>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-4 mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Amount" value={formatMoney(typedPayout.amount, typedPayout.currency)} bold />
          <Field label="Destination Type" value={typedPayout.destination_type ?? '—'} />
          <Field label="Beneficiary (Masked)" value={beneficiary?.masked_destination_value ?? '—'} />
          <Field label="Bank / Network" value={beneficiary?.bank_or_network_name ?? '—'} />
          <Field label="Transaction Reference (transId)" value={typedPayout.payout_reference} small />
          <Field label="Idempotency Key" value={typedPayout.idempotency_key} small />
          <Field label="Selcom Receipt" value={typedPayout.selcom_receipt ?? '—'} small />
          <Field label="Provider Payout Reference" value={typedPayout.provider_payout_reference ?? '—'} small />
          <Field label="Recipient Name" value={typedPayout.recipient_name ?? '—'} />
          <Field label="Purpose" value={typedPayout.purpose ?? '—'} />
          <Field label="Retry Count" value={`${typedPayout.retry_count}`} />
          {typedPayout.failure_code && <Field label="Failure Code" value={typedPayout.failure_code} />}
          {['submitted', 'processing', 'unknown'].includes(typedPayout.status) && (
            <>
              <Field label="Status Checks So Far" value={`${typedPayout.status_check_count}`} small />
              <Field
                label="Next Automatic Check"
                value={typedPayout.next_status_check_at ? new Date(typedPayout.next_status_check_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                small
              />
              <Field
                label="Polling Stops / Moves to Manual Review"
                value={typedPayout.status_check_expires_at ? new Date(typedPayout.status_check_expires_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                small
              />
            </>
          )}
        </dl>
        {typedPayout.status === 'manual_review' && (
          <p className="text-xs text-[#8a5a00] bg-orange-50 border border-orange-200 px-3 py-2">
            Automated status polling could not resolve this payout within the configured window — a human must
            review it (check the Status Check History below and use &quot;Check Status&quot; to try again manually).
          </p>
        )}
        {typedPayout.status === 'unknown' && (
          <p className="text-xs text-[#8a5a00] bg-orange-50 border border-orange-200 px-3 py-2">
            Selcom returned a status this app doesn&apos;t recognise on the last check. Automated polling will keep
            retrying until the configured window expires.
          </p>
        )}
        {typedPayout.failure_reason && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{typedPayout.failure_reason}</p>
        )}
        {typedPayout.hold_reason && typedPayout.status === 'held' && (
          <p className="text-xs text-red-800 bg-red-50 border border-red-200 px-3 py-2">On hold: {typedPayout.hold_reason} — placed by {typedPayout.held_by}</p>
        )}
        {typedPayout.reversal_reason && (
          <p className="text-xs text-orange-800 bg-orange-50 border border-orange-200 px-3 py-2">Reversed: {typedPayout.reversal_reason}</p>
        )}
        {typedPayout.cancellation_reason && (
          <p className="text-xs text-[#707975] bg-[#f5f3f3] border border-[#efeded] px-3 py-2">Cancelled: {typedPayout.cancellation_reason}</p>
        )}

        <div className="border-t border-[#efeded] pt-4 grid grid-cols-2 gap-4 text-xs text-[#707975]">
          <Field label="Requested By" value={typedPayout.requested_by} small />
          {typedPayout.approved_by && <Field label="Approved By" value={typedPayout.approved_by} small />}
        </div>
      </div>

      <div className="mb-6">
        <PayoutActions
          payoutId={typedPayout.id}
          status={typedPayout.status}
          retryCount={typedPayout.retry_count}
          canManage={canManage}
          canApprove={canApprove}
          canSubmit={canSubmit}
          canHold={canHold}
        />
      </div>

      <h2 className="font-semibold text-[#00342b] mb-3">Status Timeline</h2>
      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded]">
        {typedEvents.map((e) => (
          <div key={e.id} className="p-4">
            <p className="text-sm font-medium text-[#1b1c1c]">{MERCHANT_PAYOUT_EVENT_LABELS[e.event_type] ?? e.event_type}</p>
            <p className="text-xs text-[#707975] mt-0.5">{e.performed_by} · {new Date(e.performed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            {e.notes && <p className="text-xs text-[#3f4945] mt-1 italic">&quot;{e.notes}&quot;</p>}
          </div>
        ))}
        {typedEvents.length === 0 && <p className="p-4 text-center text-sm text-[#707975]">No events recorded yet.</p>}
      </div>

      <h2 className="font-semibold text-[#00342b] mb-3 mt-6">Status Check History</h2>
      <p className="text-xs text-[#707975] mb-3">
        Every Selcom status-query attempt for this payout — manual and scheduled — including ones that couldn&apos;t
        get a response at all. Never a full account number; this only ever queries by transId.
      </p>
      <div className="bg-white border border-[#bfc9c4] divide-y divide-[#efeded] max-h-[480px] overflow-y-auto">
        {typedStatusChecks.map((c) => (
          <div key={c.id} className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium text-[#1b1c1c]">
                {c.trigger_type === 'manual' ? 'Manual check' : 'Scheduled check'}
                {c.external_status && ` — Selcom: ${c.external_status}`}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  !c.query_succeeded
                    ? 'bg-red-50 text-red-700'
                    : c.status_applied
                      ? 'bg-green-50 text-[#1b7a3d]'
                      : 'bg-[#f5f3f3] text-[#707975]'
                }`}
              >
                {!c.query_succeeded ? 'query failed' : c.status_applied ? 'applied' : (c.skip_reason ?? 'no change')}
              </span>
            </div>
            <p className="text-xs text-[#707975] mt-0.5">
              {c.performed_by} · {new Date(c.started_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            {c.error_message && <p className="text-xs text-red-700 mt-1 italic">&quot;{c.error_message}&quot;</p>}
          </div>
        ))}
        {typedStatusChecks.length === 0 && <p className="p-4 text-center text-sm text-[#707975]">No status checks recorded yet.</p>}
      </div>
    </div>
  );
}

function Field({ label, value, bold, small }: { label: string; value: string; bold?: boolean; small?: boolean }) {
  return (
    <div>
      <dt className={`font-semibold text-[#707975] uppercase tracking-wider ${small ? 'text-[10px]' : 'text-xs'} mb-0.5`}>{label}</dt>
      <dd className={bold ? 'font-semibold text-[#00342b]' : small ? 'text-xs text-[#3f4945]' : 'text-[#1b1c1c]'}>{value}</dd>
    </div>
  );
}
