'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { ONBOARDING_STAGES, ONBOARDING_PRIORITIES, type OnboardingStage, type OnboardingPriority } from '@/data/operations';

const VALID_STAGES = new Set<string>(ONBOARDING_STAGES.map((s) => s.value));
const VALID_PRIORITIES = new Set<string>(ONBOARDING_PRIORITIES.map((p) => p.value));
const MAX_TEXT_LENGTH = 2000;

export interface CreateOnboardingCaseInput {
  clientId?: string;
  leadId?: string;
}

export async function createOnboardingCase(input: CreateOnboardingCaseInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('onboarding.manage');
  } catch {
    return { success: false, message: 'You do not have permission to create onboarding cases.' };
  }

  if (!input.clientId && !input.leadId) {
    return { success: false, message: 'Select a client or a lead.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'ONB' });
  if (numberError || !numberData) {
    console.error('Failed to generate onboarding case number', numberError);
    return { success: false, message: 'Failed to generate a case number.' };
  }

  const { data, error } = await supabase
    .from('onboarding_cases')
    .insert({
      case_number: numberData,
      client_id: input.clientId || null,
      lead_id: input.leadId || null,
      stage: 'new_inquiry',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create onboarding case', error);
    return { success: false, message: 'Failed to create onboarding case.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'onboarding_cases',
    recordId: data.id,
    newValue: { caseNumber: numberData },
  });

  revalidatePath('/admin/onboarding/pipeline');
  return { success: true, id: data.id };
}

export async function updateOnboardingCaseStage(id: string, stage: OnboardingStage): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('onboarding.manage');
  } catch {
    return { success: false, message: 'You do not have permission to move this case.' };
  }

  if (!VALID_STAGES.has(stage)) {
    return { success: false, message: 'Invalid stage.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('onboarding_cases').update({ stage }).eq('id', id);

  if (error) {
    console.error('Failed to update onboarding case stage', id, error);
    return { success: false, message: 'Failed to update stage.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'stage_change',
    module: 'onboarding_cases',
    recordId: id,
    newValue: { stage },
  });

  revalidatePath('/admin/onboarding/pipeline');
  revalidatePath(`/admin/onboarding/pipeline/${id}`);
  return { success: true };
}

// Single-argument, string-in wrapper so InlineSelect (a Client Component)
// can bind it directly — onSave={updateOnboardingCaseStageOption.bind(null, id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component. The cast is
// safe: updateOnboardingCaseStage re-validates against VALID_STAGES before
// writing anything.
export async function updateOnboardingCaseStageOption(id: string, value: string): Promise<{ success: boolean; message?: string }> {
  return updateOnboardingCaseStage(id, value as OnboardingStage);
}

export interface OnboardingCaseDetailsInput {
  priority: OnboardingPriority;
  assignedUserId?: string;
  dueDate?: string;
  notes?: string;
  blockers?: string;
  documentReferences?: string[];
  relatedContractId?: string;
  relatedProformaId?: string;
  relatedInvoiceId?: string;
}

export async function updateOnboardingCaseDetails(id: string, input: OnboardingCaseDetailsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('onboarding.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update this case.' };
  }

  if (!VALID_PRIORITIES.has(input.priority)) {
    return { success: false, message: 'Invalid priority.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('onboarding_cases')
    .update({
      priority: input.priority,
      assigned_user_id: input.assignedUserId || null,
      due_date: input.dueDate || null,
      notes: input.notes?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      blockers: input.blockers?.trim().slice(0, MAX_TEXT_LENGTH) || null,
      document_references: (input.documentReferences ?? []).map((d) => d.trim()).filter(Boolean),
      related_contract_id: input.relatedContractId || null,
      related_proforma_id: input.relatedProformaId || null,
      related_invoice_id: input.relatedInvoiceId || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update onboarding case details', id, error);
    return { success: false, message: 'Failed to save changes.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_details',
    module: 'onboarding_cases',
    recordId: id,
    newValue: { priority: input.priority },
  });

  revalidatePath(`/admin/onboarding/pipeline/${id}`);
  return { success: true };
}
