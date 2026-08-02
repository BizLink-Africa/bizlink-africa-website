'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;
const MAX_NOTE_LENGTH = 2000;

// Maps a partner's reported decision to the merchant's onboarding_status —
// this is the one place a KYC coordination record drives the workflow, and
// it only ever fires from a partner_response_received row: BizLink cannot
// advance a merchant to kyc_approved on its own say-so, only by recording
// what the partner reported.
const STATUS_FOR_PARTNER_DECISION: Record<string, string> = {
  approved: 'kyc_approved',
  rejected: 'rejected',
  additional_information_required: 'additional_information_required',
};

export interface KycCoordinationInput {
  stage: 'submitted_to_partner' | 'partner_response_received';
  partnerDecision?: string;
  partnerReference?: string;
  notes?: string;
}

export async function recordKycCoordination(
  merchantId: string,
  input: KycCoordinationInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_kyc.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record KYC coordination.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('merchant_kyc_reviews').insert({
    merchant_id: merchantId,
    stage: input.stage,
    partner_decision: input.partnerDecision || null,
    partner_reference: input.partnerReference?.trim().slice(0, MAX_TEXT_LENGTH) || null,
    notes: input.notes?.trim().slice(0, MAX_NOTE_LENGTH) || null,
    recorded_by: user.email ?? 'unknown',
  });

  if (error) {
    console.error('Failed to record merchant KYC coordination', merchantId, error);
    return { success: false, message: 'Failed to record KYC coordination.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `kyc_${input.stage}`,
    module: 'merchant_kyc_reviews',
    recordId: merchantId,
    newValue: { stage: input.stage, partnerDecision: input.partnerDecision ?? null },
  });

  // Record what the partner reported — never a decision this app makes.
  if (input.stage === 'partner_response_received' && input.partnerDecision) {
    const nextStatus = STATUS_FOR_PARTNER_DECISION[input.partnerDecision];
    if (nextStatus) {
      const { data: current } = await supabase.from('merchants').select('onboarding_status').eq('id', merchantId).single();
      await supabase.from('merchants').update({ onboarding_status: nextStatus }).eq('id', merchantId);
      await supabase.from('merchant_status_history').insert({
        merchant_id: merchantId,
        from_status: current?.onboarding_status ?? null,
        to_status: nextStatus,
        note: `Recorded from approved payment infrastructure partner response.`,
        changed_by: user.email ?? 'unknown',
      });
      await logAuditEvent({
        performedBy: user.email ?? 'unknown',
        actionType: 'status_change',
        module: 'merchants',
        recordId: merchantId,
        newValue: { to: nextStatus, source: 'partner_kyc_response' },
      });
    }
  }

  revalidatePath('/admin/merchant-operations/kyc');
  revalidatePath('/admin/merchant-operations/applications');
  revalidatePath('/admin/merchant-operations/profiles');
  revalidatePath(`/admin/merchant-operations/profiles/${merchantId}`);
  return { success: true };
}
