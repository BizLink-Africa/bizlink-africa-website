'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { CONTRACT_REVIEW_STATUSES, CONTRACT_APPROVAL_STATUSES } from '@/data/contractCompliance';

const VALID_REVIEW_STATUSES = new Set<string>(CONTRACT_REVIEW_STATUSES.map((s) => s.value));
const VALID_APPROVAL_STATUSES = new Set<string>(CONTRACT_APPROVAL_STATUSES.map((s) => s.value));

export interface ContractComplianceInput {
  contractId: string;
  requiredClauses: string[];
  reviewStatus: string;
  findings?: string;
  approvalStatus: string;
  reviewer?: string;
  reviewDate?: string;
}

export async function upsertContractCompliance(input: ContractComplianceInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('contract_compliance.manage');
  } catch {
    return { success: false, message: 'You do not have permission to manage contract compliance.' };
  }

  if (!input.contractId) {
    return { success: false, message: 'A contract is required.' };
  }
  if (!VALID_REVIEW_STATUSES.has(input.reviewStatus)) {
    return { success: false, message: 'Invalid review status.' };
  }
  if (!VALID_APPROVAL_STATUSES.has(input.approvalStatus)) {
    return { success: false, message: 'Invalid approval status.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contract_compliance')
    .insert({
      contract_id: input.contractId,
      required_clauses: input.requiredClauses,
      review_status: input.reviewStatus,
      findings: input.findings?.trim() || null,
      approval_status: input.approvalStatus,
      reviewer: input.reviewer?.trim() || null,
      review_date: input.reviewDate || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to save contract compliance record', error);
    return { success: false, message: 'Failed to save contract compliance record.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'contract_compliance',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/compliance/contracts');
  revalidatePath('/admin/compliance');
  return { success: true };
}

export async function updateContractComplianceStatus(
  id: string,
  input: { reviewStatus?: string; approvalStatus?: string }
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('contract_compliance.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update contract compliance.' };
  }

  const updates: Record<string, unknown> = {};
  if (input.reviewStatus !== undefined) {
    if (!VALID_REVIEW_STATUSES.has(input.reviewStatus)) return { success: false, message: 'Invalid review status.' };
    updates.review_status = input.reviewStatus;
  }
  if (input.approvalStatus !== undefined) {
    if (!VALID_APPROVAL_STATUSES.has(input.approvalStatus)) return { success: false, message: 'Invalid approval status.' };
    updates.approval_status = input.approvalStatus;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('contract_compliance').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update contract compliance', id, error);
    return { success: false, message: 'Failed to update.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'contract_compliance',
    recordId: id,
    newValue: input,
  });

  revalidatePath('/admin/compliance/contracts');
  revalidatePath('/admin/compliance');
  return { success: true };
}

// Single-argument wrappers so InlineSelect (a Client Component) can bind
// them directly — onSave={updateContractReviewStatus.bind(null, r.id)} —
// rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component.
export async function updateContractReviewStatus(id: string, reviewStatus: string): Promise<{ success: boolean; message?: string }> {
  return updateContractComplianceStatus(id, { reviewStatus });
}

export async function updateContractApprovalStatus(id: string, approvalStatus: string): Promise<{ success: boolean; message?: string }> {
  return updateContractComplianceStatus(id, { approvalStatus });
}
