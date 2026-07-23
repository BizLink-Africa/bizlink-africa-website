'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/data/marketing';

const MAX_TEXT_LENGTH = 200;
const VALID_PLATFORMS = new Set<string>(SOCIAL_PLATFORMS.map((p) => p.value));

export interface SocialMediaPostInput {
  platform: SocialPlatform;
  campaignId?: string;
  postReference?: string;
  postedDate?: string;
  reach: number;
  engagement: number;
  clicks: number;
  leads: number;
  conversions: number;
}

export async function createSocialMediaPost(input: SocialMediaPostInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('social_media.manage');
  } catch {
    return { success: false, message: 'You do not have permission to log social media posts.' };
  }

  if (!VALID_PLATFORMS.has(input.platform)) {
    return { success: false, message: 'Invalid platform.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('social_media_posts')
    .insert({
      platform: input.platform,
      campaign_id: input.campaignId || null,
      post_reference: input.postReference?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      posted_date: input.postedDate || null,
      reach: input.reach,
      engagement: input.engagement,
      clicks: input.clicks,
      leads: input.leads,
      conversions: input.conversions,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create social media post', error);
    return { success: false, message: 'Failed to log social media post.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'social_media_posts',
    recordId: data.id,
    newValue: { platform: input.platform },
  });

  revalidatePath('/admin/marketing/social');
  return { success: true, id: data.id };
}
