'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { computeTotals, aggregateLineItems, type ProformaStatus, type FeeInputs, type LineItemInput } from '@/data/finance';

const MAX_TEXT_LENGTH = 200;
const EDITABLE_LINE_ITEM_STATUSES = new Set<ProformaStatus>(['draft', 'pending_approval']);

export interface ProformaInput extends FeeInputs {
  clientId?: string;
  clientBusinessName: string;
  clientAddress?: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceSummary?: string;
  otherChargesDescription?: string;
  currency: string;
  validUntil?: string;
  paymentTerms?: string;
  notes?: string;
  termsAndConditions?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function createProforma(input: ProformaInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('proformas.create');
  } catch {
    return { success: false, message: 'You do not have permission to create proforma invoices.' };
  }

  if (!isNonEmptyString(input.clientBusinessName)) {
    return { success: false, message: 'Client business name is required.' };
  }

  const supabase = await createClient();
  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'PRO' });
  if (numberError || !numberData) {
    console.error('Failed to generate proforma number', numberError);
    return { success: false, message: 'Failed to generate a proforma number.' };
  }

  const totals = computeTotals(input);

  const { data, error } = await supabase
    .from('proforma_invoices')
    .insert({
      proforma_number: numberData,
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
      valid_until: input.validUntil || null,
      payment_terms: input.paymentTerms?.trim() || null,
      notes: input.notes?.trim() || null,
      terms_and_conditions: input.termsAndConditions?.trim() || null,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create proforma', error);
    return { success: false, message: 'Failed to create proforma invoice.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'proforma_invoices',
    recordId: data.id,
    newValue: { proformaNumber: numberData, total: totals.total },
  });

  revalidatePath('/admin/finance/proformas');
  return { success: true, id: data.id };
}

export async function updateProformaStatus(
  id: string,
  status: ProformaStatus,
  comment?: string
): Promise<{ success: boolean; message?: string }> {
  const needsApprovalPermission = status === 'approved' || status === 'rejected';
  let user;
  try {
    user = await requirePermission(needsApprovalPermission ? 'proformas.approve' : 'proformas.update');
  } catch {
    return { success: false, message: 'You do not have permission to perform this action.' };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === 'approved') updates.approved_by = user.email;

  const { error } = await supabase.from('proforma_invoices').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update proforma status', id, error);
    return { success: false, message: 'Failed to update proforma status.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'proforma_invoices',
    recordId: id,
    newValue: { status, comment: comment?.trim() || null },
  });

  revalidatePath('/admin/finance/proformas');
  revalidatePath(`/admin/finance/proformas/${id}`);
  return { success: true };
}

// Converts an accepted/approved proforma into a real invoice. Preserves
// client, fees, tax, discount, and notes exactly; links the invoice back to
// its source proforma; marks the proforma converted. Guards against
// double-conversion by checking converted_invoice_id first — RLS still
// enforces proformas.convert independently.
export async function convertProformaToInvoice(id: string): Promise<{ success: boolean; message?: string; invoiceId?: string }> {
  let user;
  try {
    user = await requirePermission('proformas.convert');
  } catch {
    return { success: false, message: 'You do not have permission to convert proforma invoices.' };
  }

  const supabase = await createClient();
  const { data: proforma, error: fetchError } = await supabase
    .from('proforma_invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !proforma) {
    return { success: false, message: 'Proforma invoice not found.' };
  }

  if (proforma.converted_invoice_id) {
    return { success: false, message: 'This proforma has already been converted to an invoice.' };
  }

  const { data: numberData, error: numberError } = await supabase.rpc('next_finance_number', { seq_prefix: 'INV' });
  if (numberError || !numberData) {
    console.error('Failed to generate invoice number', numberError);
    return { success: false, message: 'Failed to generate an invoice number.' };
  }

  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = proforma.valid_until ?? issueDate;

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: numberData,
      proforma_id: proforma.id,
      client_id: proforma.client_id,
      client_business_name: proforma.client_business_name,
      client_address: proforma.client_address,
      client_email: proforma.client_email,
      client_phone: proforma.client_phone,
      service_summary: proforma.service_summary,
      setup_fee: proforma.setup_fee,
      implementation_fee: proforma.implementation_fee,
      ai_automation_fee: proforma.ai_automation_fee,
      social_commerce_fee: proforma.social_commerce_fee,
      api_integration_fee: proforma.api_integration_fee,
      subscription_fee: proforma.subscription_fee,
      support_fee: proforma.support_fee,
      consulting_fee: proforma.consulting_fee,
      maintenance_fee: proforma.maintenance_fee,
      other_charges: proforma.other_charges,
      other_charges_description: proforma.other_charges_description,
      currency: proforma.currency,
      subtotal: proforma.subtotal,
      discount: proforma.discount,
      tax_percentage: proforma.tax_percentage,
      tax_amount: proforma.tax_amount,
      total: proforma.total,
      amount_paid: 0,
      outstanding_balance: proforma.total,
      issue_date: issueDate,
      due_date: dueDate,
      payment_terms: proforma.payment_terms,
      notes: proforma.notes,
      status: 'draft',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) {
    console.error('Failed to create invoice from proforma', id, invoiceError);
    return { success: false, message: 'Failed to create invoice from proforma.' };
  }

  // Carry the itemized quantity x unit price breakdown over too — the fee
  // column totals were already copied above, this just preserves the
  // "how we got there" detail on the new invoice.
  const { data: sourceLineItems } = await supabase
    .from('proforma_line_items')
    .select('category, description, quantity, unit_price, line_total')
    .eq('proforma_id', id);

  if (sourceLineItems && sourceLineItems.length > 0) {
    const { error: lineItemsError } = await supabase.from('invoice_line_items').insert(
      sourceLineItems.map((item) => ({ ...item, invoice_id: invoice.id }))
    );
    if (lineItemsError) {
      console.error('Failed to copy line items to invoice', id, lineItemsError);
    }
  }

  const { error: linkError } = await supabase
    .from('proforma_invoices')
    .update({ status: 'converted', converted_invoice_id: invoice.id })
    .eq('id', id);

  if (linkError) {
    console.error('Failed to mark proforma as converted', id, linkError);
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'convert',
    module: 'proforma_invoices',
    recordId: id,
    newValue: { invoiceId: invoice.id, invoiceNumber: numberData },
  });

  revalidatePath('/admin/finance/proformas');
  revalidatePath(`/admin/finance/proformas/${id}`);
  revalidatePath('/admin/finance/invoices');

  return { success: true, invoiceId: invoice.id };
}

// Replaces a proforma's itemized line items wholesale and rolls their
// category totals into the same fixed fee columns computeTotals() already
// knows how to sum — this is the ONLY place a line item's quantity x
// unit_price actually changes what the document totals — the create form's
// fixed fee-field entry is unaffected and both paths land on the same
// columns. Only allowed while the proforma hasn't been sent/approved yet,
// same spirit as why contracts only allow free editing pre-approval.
export async function updateProformaLineItems(
  id: string,
  items: LineItemInput[]
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('proformas.update');
  } catch {
    return { success: false, message: 'You do not have permission to edit line items.' };
  }

  const supabase = await createClient();
  const { data: proforma, error: fetchError } = await supabase
    .from('proforma_invoices')
    .select('status, discount, tax_percentage')
    .eq('id', id)
    .single();

  if (fetchError || !proforma) {
    return { success: false, message: 'Proforma invoice not found.' };
  }
  if (!EDITABLE_LINE_ITEM_STATUSES.has(proforma.status as ProformaStatus)) {
    return { success: false, message: 'Line items can only be edited while the proforma is in draft or pending approval.' };
  }

  const { error: deleteError } = await supabase.from('proforma_line_items').delete().eq('proforma_id', id);
  if (deleteError) {
    console.error('Failed to clear existing line items', id, deleteError);
    return { success: false, message: 'Failed to save line items.' };
  }

  if (items.length > 0) {
    const { error: insertError } = await supabase.from('proforma_line_items').insert(
      items.map((item) => ({
        proforma_id: id,
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
  const totals = computeTotals({ ...feeSums, discount: proforma.discount, tax_percentage: proforma.tax_percentage });

  const { error: updateError } = await supabase
    .from('proforma_invoices')
    .update({ ...feeSums, subtotal: totals.subtotal, tax_amount: totals.taxAmount, total: totals.total })
    .eq('id', id);

  if (updateError) {
    console.error('Failed to update proforma totals from line items', id, updateError);
    return { success: false, message: 'Line items saved, but failed to update totals.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_line_items',
    module: 'proforma_invoices',
    recordId: id,
    newValue: { itemCount: items.length, total: totals.total },
  });

  revalidatePath(`/admin/finance/proformas/${id}`);
  return { success: true };
}
