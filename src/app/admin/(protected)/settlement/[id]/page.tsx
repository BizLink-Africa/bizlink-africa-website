import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { hasRecentReauth, SETTLEMENT_EMERGENCY_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import AccessDenied from '@/components/admin/AccessDenied';
import BatchSummary from '@/components/admin/settlement/BatchSummary';
import BatchWorkflowActions from '@/components/admin/settlement/BatchWorkflowActions';
import CreatePayoutsButton from '@/components/admin/payouts/CreatePayoutsButton';
import SettlementEmergencyReauthPrompt from '@/components/admin/settlement/SettlementEmergencyReauthPrompt';
import type { SettlementBatch } from '@/data/settlement';

export const dynamic = 'force-dynamic';

export default async function SettlementBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('settlement.view');
  } catch {
    return <AccessDenied requiredPermission="settlement.view" />;
  }

  const permissionChecks = await Promise.all(
    ['settlement.prepare', 'settlement.review', 'settlement.approve', 'settlement.compliance_hold', 'settlement.process', 'settlement.emergency'].map(
      async (perm) => {
        try {
          await requirePermission(perm);
          return true;
        } catch {
          return false;
        }
      }
    )
  );
  const [canPrepare, canReview, canApprove, canComplianceHold, canProcess, canEmergency] = permissionChecks;

  let canManagePayouts = true;
  try {
    await requirePermission('payouts.manage');
  } catch {
    canManagePayouts = false;
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase.from('settlement_batches').select('*').eq('id', id).maybeSingle();
  if (!batch) notFound();
  const typedBatch = batch as SettlementBatch;

  const emergencyEligible = canEmergency && !['completed', 'cancelled'].includes(typedBatch.status);
  if (emergencyEligible && !(await hasRecentReauth(SETTLEMENT_EMERGENCY_REAUTH_PURPOSE))) {
    return <SettlementEmergencyReauthPrompt />;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/admin/settlement" className="text-xs font-medium text-[#00342b] hover:underline">← All Batches</Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href={`/admin/settlement/${id}/merchants`} className="text-[#00342b] font-medium border border-[#bfc9c4] px-3 py-1.5 hover:border-[#00342b]">Merchant Breakdown</Link>
        <Link href={`/admin/settlement/${id}/transactions`} className="text-[#00342b] font-medium border border-[#bfc9c4] px-3 py-1.5 hover:border-[#00342b]">Transaction Breakdown</Link>
        <Link href={`/admin/settlement/${id}/history`} className="text-[#00342b] font-medium border border-[#bfc9c4] px-3 py-1.5 hover:border-[#00342b]">Audit History</Link>
      </div>

      <BatchSummary batch={typedBatch} />

      <div className="mt-6">
        <BatchWorkflowActions
          batchId={typedBatch.id}
          status={typedBatch.status}
          complianceHold={typedBatch.compliance_hold}
          hasVariance={typedBatch.unresolved_variance !== '0.00'}
          canPrepare={canPrepare}
          canReview={canReview}
          canApprove={canApprove}
          canComplianceHold={canComplianceHold}
          canProcess={canProcess}
          canEmergency={canEmergency}
        />
      </div>

      {canManagePayouts && ['approved', 'processing', 'partially_paid'].includes(typedBatch.status) && (
        <div className="mt-6 bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Merchant Payouts</h2>
          <p className="text-xs text-[#707975] mb-4">
            Creates a payout request per merchant line — each one goes through its own maker-checker approval before submission to the sandbox disbursement adapter.
          </p>
          <CreatePayoutsButton batchId={typedBatch.id} />
        </div>
      )}
    </div>
  );
}
