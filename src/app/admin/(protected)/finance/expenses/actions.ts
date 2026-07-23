'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { EXPENSE_CATEGORIES, type ExpenseStatus } from '@/data/finance';

const MAX_TEXT_LENGTH = 200;
const VALID_CATEGORIES = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.value));

export interface ExpenseInput {
  category: string;
  description: string;
  vendor?: string;
  amount: number;
  currency: string;
  expenseDate: string;
  paymentMethod?: string;
  reference?: string;
  receiptReference?: string;
  department?: string;
  notes?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createExpense(input: ExpenseInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('expenses.create');
  } catch {
    return { success: false, message: 'You do not have permission to create expenses.' };
  }

  if (!isNonEmptyString(input.description)) {
    return { success: false, message: 'Description is required.' };
  }
  if (!VALID_CATEGORIES.has(input.category)) {
    return { success: false, message: 'Invalid category.' };
  }
  if (!(input.amount > 0)) {
    return { success: false, message: 'Amount must be greater than zero.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'EXP' });
  if (numberError || !numberData) {
    console.error('Failed to generate expense number', numberError);
    return { success: false, message: 'Failed to generate an expense number.' };
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      expense_number: numberData,
      category: input.category,
      description: input.description.trim().slice(0, MAX_TEXT_LENGTH),
      vendor: input.vendor?.trim() || null,
      amount: input.amount,
      currency: input.currency,
      expense_date: input.expenseDate,
      payment_method: input.paymentMethod?.trim() || null,
      reference: input.reference?.trim() || null,
      receipt_reference: input.receiptReference?.trim() || null,
      department: input.department?.trim() || null,
      notes: input.notes?.trim() || null,
      status: 'submitted',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create expense', error);
    return { success: false, message: 'Failed to create expense.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'expenses',
    recordId: data.id,
    newValue: { expenseNumber: numberData, amount: input.amount },
  });

  revalidatePath('/admin/finance/expenses');
  return { success: true, id: data.id };
}

// Reject-only now — approval is handled by approveExpense()/ceoApproveExpense()
// below so the CEO-threshold branch can never be bypassed by a caller that
// just passes status: 'approved' directly. Reject can happen from either
// approval stage, so it accepts whichever of the two approval permissions
// the caller actually holds rather than requiring one specific one.
export async function rejectExpense(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('expenses.approve');
  } catch {
    try {
      user = await requirePermission('expenses.ceo_approve');
    } catch {
      return { success: false, message: 'You do not have permission to reject expenses.' };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from('expenses').update({ status: 'rejected' }).eq('id', id);

  if (error) {
    console.error('Failed to reject expense', id, error);
    return { success: false, message: 'Failed to reject expense.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'status_rejected',
    module: 'expenses',
    recordId: id,
    newValue: { status: 'rejected' },
  });

  revalidatePath('/admin/finance/expenses');
  revalidatePath('/admin/finance/expense-approvals');
  return { success: true };
}

// CFO's approval stage. Reads the amount and the configurable
// expense_high_value_threshold itself (never trusts a client-passed target
// status) and decides the real next state: pending_ceo_approval above the
// threshold, approved below it. This is the one place that decision is
// made — the Expense Approvals queue page just renders whatever stage an
// expense is actually in.
export async function approveExpense(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('expenses.approve');
  } catch {
    return { success: false, message: 'You do not have permission to approve expenses.' };
  }

  const supabase = await createClient();
  const [{ data: expense, error: fetchError }, { data: settings }] = await Promise.all([
    supabase.from('expenses').select('amount, status').eq('id', id).single(),
    supabase.from('company_settings').select('expense_high_value_threshold').eq('id', true).single(),
  ]);

  if (fetchError || !expense) {
    return { success: false, message: 'Expense not found.' };
  }
  if (!['submitted', 'pending_approval'].includes(expense.status)) {
    return { success: false, message: 'This expense is not awaiting CFO approval.' };
  }

  const threshold = settings?.expense_high_value_threshold ?? 500000;
  const isHighValue = expense.amount > threshold;
  const nextStatus: ExpenseStatus = isHighValue ? 'pending_ceo_approval' : 'approved';

  const updates: Record<string, unknown> = { status: nextStatus };
  if (!isHighValue) updates.approved_by = user.email;

  const { error } = await supabase.from('expenses').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to approve expense', id, error);
    return { success: false, message: 'Failed to approve expense.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isHighValue ? 'cfo_approve_pending_ceo' : 'status_approved',
    module: 'expenses',
    recordId: id,
    newValue: { status: nextStatus, amount: expense.amount, threshold },
  });

  revalidatePath('/admin/finance/expenses');
  revalidatePath('/admin/finance/expense-approvals');
  return { success: true };
}

// CEO's final approval stage for a high-value expense already cleared by
// the CFO — only valid from pending_ceo_approval.
export async function ceoApproveExpense(id: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('expenses.ceo_approve');
  } catch {
    return { success: false, message: 'You do not have permission to give final CEO approval.' };
  }

  const supabase = await createClient();
  const { data: expense, error: fetchError } = await supabase.from('expenses').select('status').eq('id', id).single();

  if (fetchError || !expense) {
    return { success: false, message: 'Expense not found.' };
  }
  if (expense.status !== 'pending_ceo_approval') {
    return { success: false, message: 'This expense is not awaiting CEO approval.' };
  }

  const { error } = await supabase.from('expenses').update({ status: 'approved', approved_by: user.email }).eq('id', id);

  if (error) {
    console.error('Failed to record CEO approval', id, error);
    return { success: false, message: 'Failed to approve expense.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'ceo_approve',
    module: 'expenses',
    recordId: id,
    newValue: { status: 'approved' },
  });

  revalidatePath('/admin/finance/expenses');
  revalidatePath('/admin/finance/expense-approvals');
  return { success: true };
}
