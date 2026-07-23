'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { TICKET_CATEGORIES, KB_STATUSES, KB_VISIBILITY, type TicketCategory, type KbStatus, type KbVisibility } from '@/data/tickets';

const MAX_TITLE_LENGTH = 200;
const VALID_CATEGORIES = new Set<string>(TICKET_CATEGORIES.map((c) => c.value));
const VALID_STATUSES = new Set<string>(KB_STATUSES.map((s) => s.value));
const VALID_VISIBILITY = new Set<string>(KB_VISIBILITY.map((v) => v.value));

export interface KbArticleInput {
  title: string;
  content: string;
  categoryId?: string;
  visibility: KbVisibility;
  relatedCategories: TicketCategory[];
}

export async function createKbArticle(input: KbArticleInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('knowledge_base.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the knowledge base.' };
  }

  if (!input.title?.trim() || !input.content?.trim()) {
    return { success: false, message: 'Title and content are required.' };
  }
  if (!VALID_VISIBILITY.has(input.visibility)) {
    return { success: false, message: 'Invalid visibility.' };
  }
  if (input.relatedCategories.some((c) => !VALID_CATEGORIES.has(c))) {
    return { success: false, message: 'Invalid related category.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('kb_articles')
    .insert({
      title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
      content: input.content.trim(),
      category_id: input.categoryId || null,
      visibility: input.visibility,
      related_categories: input.relatedCategories,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create KB article', error);
    return { success: false, message: 'Failed to create article.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'create', module: 'kb_articles', recordId: data.id, newValue: { title: input.title } });
  revalidatePath('/admin/support/knowledge-base');
  return { success: true, id: data.id };
}

export async function updateKbArticleStatus(id: string, status: KbStatus): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('knowledge_base.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the knowledge base.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('kb_articles').update({ status }).eq('id', id);

  if (error) {
    console.error('Failed to update KB article status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'status_change', module: 'kb_articles', recordId: id, newValue: { status } });
  revalidatePath('/admin/support/knowledge-base');
  return { success: true };
}

export async function createKbCategory(name: string, description: string): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('knowledge_base.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage the knowledge base.' };
  }

  if (!name.trim()) {
    return { success: false, message: 'Category name is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('kb_categories').insert({ name: name.trim().slice(0, MAX_TITLE_LENGTH), description: description.trim() || null }).select('id').single();

  if (error || !data) {
    console.error('Failed to create KB category', error);
    return { success: false, message: 'Failed to create category.' };
  }

  await logAuditEvent({ performedBy: user.email ?? 'unknown', actionType: 'create', module: 'kb_categories', recordId: data.id, newValue: { name } });
  revalidatePath('/admin/support/knowledge-base');
  return { success: true, id: data.id };
}
