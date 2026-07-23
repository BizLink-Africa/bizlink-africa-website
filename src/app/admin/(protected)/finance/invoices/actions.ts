'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { computeTotals, aggregateLineItems, type InvoiceStatus, type FeeInputs, type LineItemInput } from '@/data/finance';

const MAX_TEXT_LENGTH = 200;
const EDITABLE_LINE_ITEM_STATUSES = new Set<InvoiceStatus>(['draft', 'pending_approval']);

export interface InvoiceInput extends FeeInputs {
  clientId?: string;
  clientBusinessName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceSummary?: string;
  otherChargesDescription?: string;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  paymentTerms?: string;
  notes?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createInvoice(input: InvoiceInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('invoices.create');
  } catch {
    return { success: false, message: 'You do not have permission to create invoices.' };
  }

  if (!isNonEmptyString(input.clientBusinessName)) {
    return { success: false, message: 'Client business name is required.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'INV' });
  if (numberError || !numberData) {
    console.error('Failed to generate invoice number', numberError);
    return { success: false, message: 'Failed to generate an invoice number.' };
  }

  const totals = computeTotals(input);

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: numberData,
      client_id: input.clientId || null,
      client_business_name: input.clientBusinessName.trim().slice(0, MAX_TEXT_LENGTH),
      client_address: input.clientAddress?.trim() || null,
      client_email: input.clientEmail?.trim() || null,
      client_phone: input.clientPhone?.trim() || null,
      service_summary: input.serviceSummary?.trim() || null,
      setup_fee: input.setup_fee,
      implementation_fee: input.implementation_fee,
      ai_automation_fee: input.ai_automation_fee,
      social_commerce_fee: input.social_commerce_fee,
      api_integration_fee: input.api_integration_fee,
      subscription_fee: input.subscription_fee,
      support_fee: input.support_fee,
      consulting_fee: input.consulting_fee,
      maintenance_fee: input.maintenance_fee,
      other_charges: input.other_charges,
      other_charges_description: input.otherChargesDescription?.trim() || null,
      currency: input.currency,
      subtotal: totals.subtotal,
      discount: input.discount,
      tax_percentage: input.tax_percentage,
      tax_amount: totals.taxAmount,
      total: totals.total,
      amount_paid: 0,
      outstanding_balance: totals.total,
      issue_date: input.issueDate || null,
      due_date: input.dueDate || null,
      payment_terms: input.paymentTerms?.trim() || null,
      notes: input.notes?.trim() || null,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create invoice', error);
    return { success: false, message: 'Failed to create invoice.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'invoices',
    recordId: data.id,
    newValue: { invoiceNumber: numberData, total: totals.total },
  });

  revalidatePath('/admin/finance/invoices');
  return { success: true, id: data.id };
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<{ success: boolean; message?: string }> {
  const permission = status === 'issued' ? 'invoices.issue' : status === 'cancelled' ? 'invoices.cancel' : 'invoices.update';
  let user;
  try {
    user = await requirePermission(permission);
  } catch {
    return { success: false, message: 'You do not have permission to perform this action.' };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === 'approved') updates.approved_by = user.email;
  if (status === 'issued') updates.issued_by = user.email;

  const { error } = await supabase.from('invoices').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update invoice status', id, error);
    return { success: false, message: 'Failed to update invoice status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'invoices',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/finance/invoices');
  revalidatePath(`/admin/finance/invoices/${id}`);
  return { success: true };
}

export interface RecordPaymentInput {
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  reference?: string;
  receiptReference?: string;
  notes?: string;
}

// Records a payment and derives the invoice's new status from the running
// total — partially_paid if under the invoice total, paid if it meets or
// exceeds it. Both writes happen for a single invoice id sequentially
// within one request; there is no concurrent-payment scenario in this
// admin-only workflow that would need row locking beyond what Postgres
// already provides per statement.
export async function recordInvoicePayment(
  invoiceId: string,
  input: RecordPaymentInput
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('invoices.record_payment');
  } catch {
    return { success: false, message: 'You do not have permission to record payments.' };
  }

  if (!(input.amount > 0)) {
    return { success: false, message: 'Payment amount must be greater than zero.' };
  }

  const supabase = await createClient();
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('total, amount_paid, currency')
    .eq('id', invoiceId)
    .single();

  if (fetchError || !invoice) {
    return { success: false, message: 'Invoice not found.' };
  }

  const { error: paymentError } = await supabase.from('invoice_payments').insert({
    invoice_id: invoiceId,
    amount: input.amount,
    currency: invoice.currency,
    payment_date: input.paymentDate,
    payment_method: input.paymentMethod?.trim() || null,
    reference: input.reference?.trim() || null,
    receipt_reference: input.receiptReference?.trim() || null,
    recorded_by: user.email,
    notes: input.notes?.trim() || null,
  });

  if (paymentError) {
    console.error('Failed to record payment', invoiceId, paymentError);
    return { success: false, message: 'Failed to record payment.' };
  }

  const newAmountPaid = Math.round((invoice.amount_paid + input.amount) * 100) / 100;
  const newOutstanding = Math.round((invoice.total - newAmountPaid) * 100) / 100;
  const newStatus = newOutstanding <= 0 ? 'paid' : 'partially_paid';

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ amount_paid: newAmountPaid, outstanding_balance: Math.max(0, newOutstanding), status: newStatus })
    .eq('id', invoiceId);

  if (updateError) {
    console.error('Failed to update invoice after payment', invoiceId, updateError);
    return { success: false, message: 'Payment recorded, but failed to update invoice balance.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'record_payment',
    module: 'invoices',
    recordId: invoiceId,
    newValue: { amount: input.amount, newStatus },
  });

  revalidatePath('/admin/finance/invoices');
  revalidatePath(`/admin/finance/invoices/${invoiceId}`);
  return { success: true };
}

// Same idea as updateProformaLineItems — rolls itemized quantity x
// unit_price rows into the fixed fee columns computeTotals() sums. Only
// allowed before an invoice is issued (issuing locks the amount a client
// was actually billed); amount_paid is untouched and outstanding_balance
// is re-derived from the new total so a mid-edit never desyncs the two.
export async function updateInvoiceLineItems(
  id: string,
  items: LineItemInput[]
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('invoices.update');
  } catch {
    return { success: false, message: 'You do not have permission to edit line items.' };
  }

  const supabase = await createClient();
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, discount, tax_percentage, amount_paid')
    .eq('id', id)
    .single();

  if (fetchError || !invoice) {
    return { success: false, message: 'Invoice not found.' };
  }
  if (!EDITABLE_LINE_ITEM_STATUSES.has(invoice.status as InvoiceStatus)) {
    return { success: false, message: 'Line items can only be edited while the invoice is in draft or pending approval.' };
  }

  const { error: deleteError } = await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
  if (deleteError) {
    console.error('Failed to clear existing line items', id, deleteError);
    return { success: false, message: 'Failed to save line items.' };
  }

  if (items.length > 0) {
    const { error: insertError } = await supabase.from('invoice_line_items').insert(
      items.map((item) => ({
        invoice_id: id,
        category: item.category,
        description: item.description.trim().slice(0, MAX_TEXT_LENGTH),
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: Math.round(item.quantity * item.unit_price * 100) / 100,
      }))
    );
    if (insertError) {
      console.error('Failed to insert line items', id, insertError);
      return { success: false, message: 'Failed to save line items.' };
    }
  }

  const feeSums = aggregateLineItems(items);
  const totals = computeTotals({ ...feeSums, discount: invoice.discount, tax_percentage: invoice.tax_percentage });
  const outstandingBalance = Math.max(0, Math.round((totals.total - invoice.amount_paid) * 100) / 100);

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      ...feeSums,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total: totals.total,
      outstanding_balance: outstandingBalance,
    })
    .eq('id', id);

  if (updateError) {
    console.error('Failed to update invoice totals from line items', id, updateError);
    return { success: false, message: 'Line items saved, but failed to update totals.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_line_items',
    module: 'invoices',
    recordId: id,
    newValue: { itemCount: items.length, total: totals.total },
  });

  revalidatePath(`/admin/finance/invoices/${id}`);
  return { success: true };
}
