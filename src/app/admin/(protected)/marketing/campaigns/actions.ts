'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { CAMPAIGN_TYPES, type CampaignChannel, type CampaignType } from '@/data/marketing';

const MAX_TEXT_LENGTH = 200;
const VALID_TYPES = new Set<string>(CAMPAIGN_TYPES.map((t) => t.value));

export interface CampaignInput {
  name: string;
  type?: CampaignType;
  channels: CampaignChannel[];
  objective?: string;
  startDate?: string;
  endDate?: string;
  budget: number;
  actualSpend?: number;
  currency: string;
  targetAudience?: string;
  ownerUserId?: string;
  description?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createCampaign(input: CampaignInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('campaigns.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create campaigns.' };
  }

  if (!isNonEmptyString(input.name)) {
    return { success: false, message: 'Campaign name is required.' };
  }
  if (input.type && !VALID_TYPES.has(input.type)) {
    return { success: false, message: 'Invalid campaign type.' };
  }
  if (!input.channels || input.channels.length === 0) {
    return { success: false, message: 'Select at least one channel.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .insert({
      name: input.name.trim().slice(0, MAX_TEXT_LENGTH),
      type: input.type || null,
      channel: input.channels[0],
      channels: input.channels,
      objective: input.objective?.trim() || null,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      budget: input.budget,
      actual_spend: input.actualSpend ?? 0,
      currency: input.currency,
      target_audience: input.targetAudience?.trim() || null,
      owner_user_id: input.ownerUserId || null,
      description: input.description?.trim() || null,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create campaign', error);
    return { success: false, message: 'Failed to create campaign.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'marketing_campaigns',
    recordId: data.id,
    newValue: { name: input.name, channels: input.channels },
  });

  revalidatePath('/admin/marketing/campaigns');
  revalidatePath('/admin/marketing');
  return { success: true, id: data.id };
}

export async function updateCampaignStatus(id: string, status: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('campaigns.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update campaigns.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('marketing_campaigns').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update campaign status', id, error);
    return { success: false, message: 'Failed to update campaign status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'marketing_campaigns',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/marketing/campaigns');
  revalidatePath(`/admin/marketing/campaigns/${id}`);
  revalidatePath('/admin/marketing');
  return { success: true };
}

export interface CampaignDetailsInput {
  budget: number;
  actualSpend: number;
  ownerUserId?: string;
  targetAudience?: string;
  notes?: string;
}

// Edits the fields that aren't part of the status machine or the
// channel/type set at creation. Leads/conversions/revenue are never
// editable here — they're always live-computed from the CRM (see
// getCampaignAttributionMap in marketing-adapters.ts), not stored on the
// campaign row, so there's nothing to manually correct.
export async function updateCampaignDetails(id: string, input: CampaignDetailsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('campaigns.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update campaigns.' };
  }

  if (input.budget < 0 || input.actualSpend < 0) {
    return { success: false, message: 'Budget and actual spend cannot be negative.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('marketing_campaigns')
    .update({
      budget: input.budget,
      actual_spend: input.actualSpend,
      owner_user_id: input.ownerUserId || null,
      target_audience: input.targetAudience?.trim() || null,
      description: input.notes?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update campaign details', id, error);
    return { success: false, message: 'Failed to update campaign.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_details',
    module: 'marketing_campaigns',
    recordId: id,
    newValue: { budget: input.budget, actualSpend: input.actualSpend },
  });

  revalidatePath('/admin/marketing/campaigns');
  revalidatePath(`/admin/marketing/campaigns/${id}`);
  revalidatePath('/admin/marketing');
  return { success: true };
}
