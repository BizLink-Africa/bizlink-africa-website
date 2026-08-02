'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

export async function requestMerchantTill(
  merchantId: string,
  notes?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_tills.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage merchant tills.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('merchant_tills')
    .insert({ merchant_id: merchantId, status: 'requested', notes: notes?.trim() || null, created_by: user.email ?? 'unknown' })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to request merchant till', merchantId, error);
    return { success: false, message: 'Failed to request till.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'request_till',
    module: 'merchant_tills',
    recordId: data.id,
    newValue: { merchantId },
  });

  revalidatePath('/admin/merchant-operations/tills');
  return { success: true };
}

export interface UpdateTillInput {
  status: string;
  partnerTillReference?: string;
  notes?: string;
}

// When a till reaches "created", the merchant's own till_reference summary
// field and onboarding_status are updated to match — the same
// event-drives-status linkage used for KYC coordination.
export async function updateMerchantTill(
  tillId: string,
  merchantId: string,
  input: UpdateTillInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('merchant_tills.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage merchant tills.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('merchant_tills')
    .update({
      status: input.status,
      partner_till_reference: input.partnerTillReference?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      notes: input.notes?.trim() || null,
      created_at_partner: input.status === 'created' ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', tillId);

  if (error) {
    console.error('Failed to update merchant till', tillId, error);
    return { success: false, message: 'Failed to update till.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_till_status',
    module: 'merchant_tills',
    recordId: tillId,
    newValue: { status: input.status },
  });

  if (input.status === 'created') {
    const { data: current } = await supabase.from('merchants').select('onboarding_status').eq('id', merchantId).single();
    await supabase
      .from('merchants')
      .update({ till_reference: input.partnerTillReference?.trim() || null, onboarding_status: 'till_created' })
      .eq('id', merchantId);
    await supabase.from('merchant_status_history').insert({
      merchant_id: merchantId,
      from_status: current?.onboarding_status ?? null,
      to_status: 'till_created',
      note: 'Till/payment-account created by approved payment infrastructure partner.',
      changed_by: user.email ?? 'unknown',
    });
    await logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'status_change',
      module: 'merchants',
      recordId: merchantId,
      newValue: { to: 'till_created', source: 'till_created' },
    });
  }

  revalidatePath('/admin/merchant-operations/tills');
  revalidatePath(`/admin/merchant-operations/profiles/${merchantId}`);
  return { success: true };
}
