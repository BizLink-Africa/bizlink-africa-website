'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { REFERRAL_PARTNERSHIP_TYPES, REFERRAL_PARTNERSHIP_STATUSES, type ReferralPartnershipType, type ReferralPartnershipStatus } from '@/data/marketing';

const MAX_TEXT_LENGTH = 200;
const VALID_TYPES = new Set<string>(REFERRAL_PARTNERSHIP_TYPES.map((t) => t.value));
const VALID_STATUSES = new Set<string>(REFERRAL_PARTNERSHIP_STATUSES.map((s) => s.value));

export interface ReferralPartnershipInput {
  type: ReferralPartnershipType;
  referrerOrPartnerName: string;
  campaignId?: string;
  notes?: string;
}

// Shared by both the Referral Campaigns and Partnership Campaigns pages —
// same table (referral_partnership_campaigns), distinguished by `type`.
export async function createReferralPartnership(input: ReferralPartnershipInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('referrals.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage referrals/partnerships.' };
  }

  if (!VALID_TYPES.has(input.type)) {
    return { success: false, message: 'Invalid type.' };
  }
  if (!input.referrerOrPartnerName?.trim()) {
    return { success: false, message: 'Referrer/partner name is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('referral_partnership_campaigns')
    .insert({
      type: input.type,
      referrer_or_partner_name: input.referrerOrPartnerName.trim().slice(0, MAX_TEXT_LENGTH),
      campaign_id: input.campaignId || null,
      notes: input.notes?.trim() || null,
      status: 'active',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create referral/partnership', error);
    return { success: false, message: 'Failed to create.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'referral_partnership_campaigns',
    recordId: data.id,
    newValue: { type: input.type, name: input.referrerOrPartnerName },
  });

  revalidatePath('/admin/marketing/referrals');
  revalidatePath('/admin/marketing/partnerships');
  return { success: true, id: data.id };
}

export async function updateReferralPartnershipStatus(id: string, status: ReferralPartnershipStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('referrals.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage referrals/partnerships.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('referral_partnership_campaigns').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update referral/partnership status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'status_change', module: 'referral_partnership_campaigns', recordId: id, newValue: { status } });
  revalidatePath('/admin/marketing/referrals');
  revalidatePath('/admin/marketing/partnerships');
  return { success: true };
}
