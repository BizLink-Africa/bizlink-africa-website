'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const MAX_TEXT_LENGTH = 200;

export interface EmailCampaignInput {
  subject: string;
  audienceDescription?: string;
  campaignId?: string;
  sentDate?: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  leads: number;
  conversions: number;
  unsubscribes: number;
}

export async function createEmailCampaign(input: EmailCampaignInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('email_campaigns.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage email campaigns.' };
  }

  if (!input.subject?.trim()) {
    return { success: false, message: 'Subject is required.' };
  }
  if (input.deliveredCount > input.sentCount) {
    return { success: false, message: 'Delivered count cannot exceed sent count.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      subject: input.subject.trim().slice(0, MAX_TEXT_LENGTH),
      audience_description: input.audienceDescription?.trim() || null,
      campaign_id: input.campaignId || null,
      sent_date: input.sentDate || null,
      sent_count: input.sentCount,
      delivered_count: input.deliveredCount,
      opened_count: input.openedCount,
      clicked_count: input.clickedCount,
      leads: input.leads,
      conversions: input.conversions,
      unsubscribes: input.unsubscribes,
      status: input.sentDate ? 'sent' : 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create email campaign', error);
    return { success: false, message: 'Failed to create email campaign.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'email_campaigns',
    recordId: data.id,
    newValue: { subject: input.subject },
  });

  revalidatePath('/admin/marketing/email-campaigns');
  return { success: true, id: data.id };
}
