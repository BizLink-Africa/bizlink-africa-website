'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

const REPORTING_PREFERENCES = ['weekly', 'monthly', 'quarterly'] as const;

export interface MarketingSettingsInput {
  defaultChannels: string[];
  reportingPreference: string;
}

export async function updateMarketingSettings(input: MarketingSettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('marketing.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change marketing settings.' };
  }

  if (input.defaultChannels.length === 0) {
    return { success: false, message: 'Select at least one default channel.' };
  }
  if (!REPORTING_PREFERENCES.includes(input.reportingPreference as (typeof REPORTING_PREFERENCES)[number])) {
    return { success: false, message: 'Invalid reporting preference.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      marketing_default_channels: input.defaultChannels,
      marketing_reporting_preference: input.reportingPreference,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update marketing settings', error);
    return { success: false, message: 'Failed to save marketing settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/settings/marketing');
  return { success: true };
}

export async function setCampaignCategoryActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('marketing.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change marketing settings.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('marketing_campaign_categories').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update campaign category', id, error);
    return { success: false, message: 'Failed to save campaign category.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isActive ? 'activate' : 'deactivate',
    module: 'marketing_campaign_categories',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/settings/marketing');
  return { success: true };
}

// Single-argument, string-in wrapper so InlineSelect (a Client Component)
// can bind it directly — onSave={setCampaignCategoryActiveOption.bind(null, c.id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component.
export async function setCampaignCategoryActiveOption(id: string, value: string): Promise<{ success: boolean; message?: string }> {
  return setCampaignCategoryActive(id, value === 'true');
}

export async function setLeadSourceActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('marketing.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change marketing settings.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('marketing_lead_sources').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update lead source', id, error);
    return { success: false, message: 'Failed to save lead source.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isActive ? 'activate' : 'deactivate',
    module: 'marketing_lead_sources',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/settings/marketing');
  return { success: true };
}

// Single-argument, string-in wrapper so InlineSelect (a Client Component)
// can bind it directly — onSave={setLeadSourceActiveOption.bind(null, s.id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component.
export async function setLeadSourceActiveOption(id: string, value: string): Promise<{ success: boolean; message?: string }> {
  return setLeadSourceActive(id, value === 'true');
}
