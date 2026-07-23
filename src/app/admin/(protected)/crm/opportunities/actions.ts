'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { OpportunityStage } from '@/data/crm';

const MAX_TEXT_LENGTH = 200;

export interface OpportunityInput {
  name: string;
  clientId?: string;
  leadId?: string;
  relatedService?: string;
  estimatedValue: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string;
  ownerUserId?: string;
  competitorNotes?: string;
  nextAction?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createOpportunity(input: OpportunityInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('opportunities.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create opportunities.' };
  }

  if (!isNonEmptyString(input.name)) {
    return { success: false, message: 'Opportunity name is required.' };
  }
  if (!input.clientId && !input.leadId) {
    return { success: false, message: 'An opportunity must be linked to a client or a lead.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'OPP' });
  if (numberError || !numberData) {
    console.error('Failed to generate opportunity number', numberError);
    return { success: false, message: 'Failed to generate an opportunity number.' };
  }

  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      opportunity_number: numberData,
      name: input.name.trim().slice(0, MAX_TEXT_LENGTH),
      client_id: input.clientId || null,
      lead_id: input.leadId || null,
      related_service: input.relatedService || null,
      estimated_value: input.estimatedValue,
      currency: input.currency,
      probability: input.probability,
      expected_close_date: input.expectedCloseDate || null,
      owner_user_id: input.ownerUserId || null,
      competitor_notes: input.competitorNotes?.trim() || null,
      next_action: input.nextAction?.trim() || null,
      stage: 'identified',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create opportunity', error);
    return { success: false, message: 'Failed to create opportunity.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'opportunities',
    recordId: data.id,
    newValue: { opportunityNumber: numberData, name: input.name, estimatedValue: input.estimatedValue },
  });

  revalidatePath('/admin/crm/opportunities');
  revalidatePath('/admin/crm/pipeline');
  return { success: true, id: data.id };
}

export async function updateOpportunityStage(id: string, stage: OpportunityStage): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('opportunities.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update opportunities.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('opportunities').update({ stage }).eq('id', id);

  if (error) {
    console.error('Failed to update opportunity stage', id, error);
    return { success: false, message: 'Failed to update stage.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `stage_${stage}`,
    module: 'opportunities',
    recordId: id,
    newValue: { stage },
  });

  revalidatePath('/admin/crm/opportunities');
  revalidatePath(`/admin/crm/opportunities/${id}`);
  revalidatePath('/admin/crm/pipeline');
  return { success: true };
}

export interface OpportunityUpdates {
  nextAction?: string | null;
  competitorNotes?: string | null;
  estimatedValue?: number;
  probability?: number;
  expectedCloseDate?: string | null;
  ownerUserId?: string | null;
}

export async function updateOpportunity(id: string, updates: OpportunityUpdates): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('opportunities.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update opportunities.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('opportunities')
    .update({
      ...(updates.nextAction !== undefined ? { next_action: updates.nextAction?.trim() || null } : {}),
      ...(updates.competitorNotes !== undefined ? { competitor_notes: updates.competitorNotes?.trim() || null } : {}),
      ...(updates.estimatedValue !== undefined ? { estimated_value: updates.estimatedValue } : {}),
      ...(updates.probability !== undefined ? { probability: updates.probability } : {}),
      ...(updates.expectedCloseDate !== undefined ? { expected_close_date: updates.expectedCloseDate || null } : {}),
      ...(updates.ownerUserId !== undefined ? { owner_user_id: updates.ownerUserId || null } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update opportunity', id, error);
    return { success: false, message: 'Failed to update opportunity.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'opportunities',
    recordId: id,
    newValue: updates,
  });

  revalidatePath(`/admin/crm/opportunities/${id}`);
  revalidatePath('/admin/crm/pipeline');
  return { success: true };
}
