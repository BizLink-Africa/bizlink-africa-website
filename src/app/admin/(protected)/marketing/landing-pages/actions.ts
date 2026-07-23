'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { LANDING_PAGE_STATUSES, type LandingPageStatus } from '@/data/marketing';

const MAX_TEXT_LENGTH = 200;
const VALID_STATUSES = new Set<string>(LANDING_PAGE_STATUSES.map((s) => s.value));

export interface LandingPageInput {
  pageName: string;
  urlReference?: string;
  campaignId?: string;
  visits: number;
  formSubmissions: number;
}

export async function createLandingPage(input: LandingPageInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('landing_pages.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage landing pages.' };
  }

  if (!input.pageName?.trim()) {
    return { success: false, message: 'Page name is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('landing_pages')
    .insert({
      page_name: input.pageName.trim().slice(0, MAX_TEXT_LENGTH),
      url_reference: input.urlReference?.trim() || null,
      campaign_id: input.campaignId || null,
      visits: input.visits,
      form_submissions: input.formSubmissions,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create landing page', error);
    return { success: false, message: 'Failed to create landing page.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'landing_pages',
    recordId: data.id,
    newValue: { pageName: input.pageName },
  });

  revalidatePath('/admin/marketing/landing-pages');
  return { success: true, id: data.id };
}

export async function updateLandingPageStatus(id: string, status: LandingPageStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('landing_pages.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage landing pages.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('landing_pages').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update landing page status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'status_change', module: 'landing_pages', recordId: id, newValue: { status } });
  revalidatePath('/admin/marketing/landing-pages');
  return { success: true };
}
