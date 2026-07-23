'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { PolicyCategory } from '@/data/governance';

const MAX_TEXT_LENGTH = 200;

export interface PolicyInput {
  title: string;
  category: PolicyCategory;
  version?: string;
  effectiveDate?: string;
  reviewDate?: string;
  owner?: string;
  content?: string;
  fileUrl?: string;
  acknowledgementRequired?: boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createPolicy(input: PolicyInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('policies.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create policy documents.' };
  }

  if (!isNonEmptyString(input.title)) {
    return { success: false, message: 'Title is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('governance_policies')
    .insert({
      title: input.title.trim().slice(0, MAX_TEXT_LENGTH),
      category: input.category,
      version: input.version?.trim() || '1.0',
      effective_date: input.effectiveDate || null,
      review_date: input.reviewDate || null,
      owner: input.owner?.trim() || null,
      content: input.content?.trim() || null,
      file_url: input.fileUrl?.trim() || null,
      acknowledgement_required: input.acknowledgementRequired ?? false,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create policy', error);
    return { success: false, message: 'Failed to create policy document.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'governance_policies',
    recordId: data.id,
    newValue: { title: input.title, category: input.category },
  });

  revalidatePath('/admin/governance/policies');
  return { success: true, id: data.id };
}

export async function updatePolicyStatus(id: string, status: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('policies.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update policy documents.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('governance_policies').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update policy status', id, error);
    return { success: false, message: 'Failed to update policy status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'governance_policies',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/governance/policies');
  return { success: true };
}
