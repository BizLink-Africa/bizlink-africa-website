export const PROFORMA_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type ProformaStatus = (typeof PROFORMA_STATUSES)[number]['value'];

export const INVOICE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'written_off', label: 'Written Off' },
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]['value'];

export const EXPENSE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'pending_ceo_approval', label: 'Pending CEO Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]['value'];

export const EXPENSE_CATEGORIES = [
  { value: 'salaries', label: 'Salaries & Wages' },
  { value: 'software_subscriptions', label: 'Software & Subscriptions' },
  { value: 'hosting_infrastructure', label: 'Hosting & Infrastructure' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'office_rent', label: 'Office & Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'travel', label: 'Travel' },
  { value: 'professional_fees', label: 'Professional Fees' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['value'];

export const FEE_FIELDS = [
  { key: 'setup_fee', label: 'Setup Fee' },
  { key: 'implementation_fee', label: 'Implementation Fee' },
  { key: 'ai_automation_fee', label: 'AI Automation Fee' },
  { key: 'social_commerce_fee', label: 'Social Commerce Fee' },
  { key: 'api_integration_fee', label: 'API Integration Fee' },
  { key: 'subscription_fee', label: 'Subscription Fee' },
  { key: 'support_fee', label: 'Support Fee' },
  { key: 'consulting_fee', label: 'Consulting Fee' },
  { key: 'maintenance_fee', label: 'Maintenance Fee' },
  { key: 'other_charges', label: 'Other Charges' },
] as const;

export type FeeFieldKey = (typeof FEE_FIELDS)[number]['key'];

// Line items use the exact same 10 categories as the fixed fee columns —
// a line item's category determines which fee column its amount rolls up
// into (see aggregateLineItems below).
export type LineItemCategory = FeeFieldKey;

export const TAX_CATEGORIES = [
  { value: 'vat', label: 'VAT' },
  { value: 'paye', label: 'PAYE' },
  { value: 'withholding', label: 'Withholding Tax' },
  { value: 'skills_development_levy', label: 'Skills Development Levy' },
  { value: 'other', label: 'Other' },
] as const;

export type TaxCategory = (typeof TAX_CATEGORIES)[number]['value'];

export const TAX_FILING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'filed', label: 'Filed' },
  { value: 'paid', label: 'Paid' },
] as const;

export type TaxFilingStatus = (typeof TAX_FILING_STATUSES)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

// Receivables aging — shared by the Receivables page and the Financial
// Reports "Receivables Aging" CSV export, so the two can never bucket a
// given invoice differently. Boundaries are inclusive on the upper edge
// (day 30 is "1-30", day 31 is "31-60") so every day maps to exactly one
// bucket with no gap or overlap.
export const AGING_BUCKETS = [
  { key: 'current', label: 'Not Yet Due', test: (days: number) => days <= 0 },
  { key: 'b1', label: '1–30 Days Overdue', test: (days: number) => days > 0 && days <= 30 },
  { key: 'b2', label: '31–60 Days Overdue', test: (days: number) => days > 30 && days <= 60 },
  { key: 'b3', label: '61–90 Days Overdue', test: (days: number) => days > 60 && days <= 90 },
  { key: 'b4', label: '90+ Days Overdue', test: (days: number) => days > 90 },
] as const;

export function daysOverdue(dueDate: string | null, today: string): number {
  if (!dueDate) return 0;
  const diffMs = new Date(today).getTime() - new Date(dueDate).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Rounds to cent precision first so a value that's merely a tiny negative
// float residual (e.g. -0.00001, or an exact -0 from a subtraction like
// spent - spent) can be caught by the === 0 check below — toLocaleString
// alone would still render either of those as "-0.00", since JS preserves
// the sign bit on negative zero through string formatting.
export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const normalized = rounded === 0 ? 0 : rounded;
  return `${currency} ${normalized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface FeeInputs {
  setup_fee: number;
  implementation_fee: number;
  ai_automation_fee: number;
  social_commerce_fee: number;
  api_integration_fee: number;
  subscription_fee: number;
  support_fee: number;
  consulting_fee: number;
  maintenance_fee: number;
  other_charges: number;
  discount: number;
  tax_percentage: number;
}

export interface ComputedTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

// Single source of truth for the money math — used identically by proforma
// and invoice creation/update so the two documents can never disagree on
// how a total is derived.
export function computeTotals(fees: FeeInputs): ComputedTotals {
  const subtotal =
    fees.setup_fee +
    fees.implementation_fee +
    fees.ai_automation_fee +
    fees.social_commerce_fee +
    fees.api_integration_fee +
    fees.subscription_fee +
    fees.support_fee +
    fees.consulting_fee +
    fees.maintenance_fee +
    fees.other_charges;
  const taxableAmount = Math.max(0, subtotal - fees.discount);
  const taxAmount = Math.round(((taxableAmount * fees.tax_percentage) / 100) * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, taxAmount, total };
}

export interface ProformaInvoice {
  id: string;
  proforma_number: string;
  client_id: string | null;
  client_business_name: string;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  service_summary: string | null;
  setup_fee: number;
  implementation_fee: number;
  ai_automation_fee: number;
  social_commerce_fee: number;
  api_integration_fee: number;
  subscription_fee: number;
  support_fee: number;
  consulting_fee: number;
  maintenance_fee: number;
  other_charges: number;
  other_charges_description: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax_percentage: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  payment_terms: string | null;
  notes: string | null;
  terms_and_conditions: string | null;
  status: ProformaStatus;
  created_by: string | null;
  approved_by: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  proforma_id: string | null;
  client_id: string | null;
  client_business_name: string;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  service_summary: string | null;
  setup_fee: number;
  implementation_fee: number;
  ai_automation_fee: number;
  social_commerce_fee: number;
  api_integration_fee: number;
  subscription_fee: number;
  support_fee: number;
  consulting_fee: number;
  maintenance_fee: number;
  other_charges: number;
  other_charges_description: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax_percentage: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  outstanding_balance: number;
  issue_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  payment_reference: string | null;
  notes: string | null;
  status: InvoiceStatus;
  created_by: string | null;
  approved_by: string | null;
  issued_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  receipt_reference: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

// A document's itemized quantity x unit price breakdown. `document_id`
// isn't a DB column — callers pass proforma_id or invoice_id separately
// depending which table they're writing to; this shape is what both
// proforma_line_items and invoice_line_items rows look like.
export interface LineItem {
  id: string;
  category: LineItemCategory;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface LineItemInput {
  category: LineItemCategory;
  description: string;
  quantity: number;
  unit_price: number;
}

// Sums a set of line items by category into the same shape the fixed fee
// columns use (see FEE_FIELDS) — the single place line items become fee
// amounts, so computeTotals() never needs to know line items exist.
export function aggregateLineItems(items: LineItemInput[]): Record<LineItemCategory, number> {
  const totals = Object.fromEntries(FEE_FIELDS.map((f) => [f.key, 0])) as Record<LineItemCategory, number>;
  for (const item of items) {
    const lineTotal = Math.round(item.quantity * item.unit_price * 100) / 100;
    totals[item.category] = Math.round((totals[item.category] + lineTotal) * 100) / 100;
  }
  return totals;
}

export interface TaxRecord {
  id: string;
  tax_period: string;
  tax_category: TaxCategory;
  taxable_amount: number;
  tax_amount: number;
  filing_status: TaxFilingStatus;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastNote {
  id: string;
  period: string;
  scenario_notes: string;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  expense_number: string;
  category: ExpenseCategory;
  description: string;
  vendor: string | null;
  amount: number;
  currency: string;
  expense_date: string;
  payment_method: string | null;
  reference: string | null;
  receipt_reference: string | null;
  department: string | null;
  status: ExpenseStatus;
  created_by: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
