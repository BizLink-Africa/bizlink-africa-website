export const CONTRACT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'pending_compliance_review', label: 'Pending Compliance Review' },
  { value: 'pending_ceo_approval', label: 'Pending CEO Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent_to_client', label: 'Sent to Client' },
  { value: 'awaiting_signature', label: 'Awaiting Signature' },
  { value: 'signed', label: 'Signed' },
  { value: 'active', label: 'Active' },
  { value: 'renewed', label: 'Renewed' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

// Not a stored status — computed from end_date wherever a contract is
// displayed, same approach as "overdue" invoices elsewhere in this app.
export function computeExpiryFlag(
  status: ContractStatus,
  endDate: string | null,
  renewalNoticePeriodDays: number,
  today: string
): 'expired' | 'expiring_soon' | null {
  if (!endDate || !['active', 'signed'].includes(status)) return null;
  if (endDate < today) return 'expired';
  const noticeDate = new Date(endDate);
  noticeDate.setDate(noticeDate.getDate() - renewalNoticePeriodDays);
  if (noticeDate.toISOString().slice(0, 10) <= today) return 'expiring_soon';
  return null;
}

export interface Contract {
  id: string;
  contract_number: string;
  contract_title: string;
  client_id: string | null;
  lead_id: string | null;
  proforma_id: string | null;
  invoice_id: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  contract_value: number | null;
  currency: string;
  payment_terms: string | null;
  contract_owner: string | null;
  operations_owner: string | null;
  status: ContractStatus;
  signed_date: string | null;
  renewal_notice_period_days: number;
  current_version: number;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;

  // Merchant/agent onboarding profile — safe fields, visible to anyone
  // with contracts.view.
  merchant_agent_name: string | null;
  outlet_name: string | null;
  business_name: string | null;
  business_registration_number: string | null;
  main_products_or_services: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  ward: string | null;
  region: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  contact_name: string | null;
  contact_designation: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notification_phone: string | null;
  notification_email: string | null;
  business_type: string | null;
  year_of_incorporation: number | null;
  years_of_operation: number | null;
}

export interface ContractVersion {
  id: string;
  contract_id: string;
  version_number: number;
  file_path: string;
  file_name: string;
  uploaded_by: string | null;
  notes: string | null;
  created_at: string;
}

// Restricted tier — a separate table in the database (not just a hidden UI
// section) so contracts.view alone can never expose this, only
// contracts.sensitive.view.
export interface ContractSensitiveDetails {
  contract_id: string;
  tin: string | null;
  tin_registration_date: string | null;
  nida: string | null;
  business_licence_number: string | null;
  business_licence_expiry_date: string | null;
  monthly_turnover: number | null;
  daily_cash_collection: number | null;
  uses_mobile_money: boolean;
  mobile_money_providers: string | null;
  daily_mobile_money_collection: number | null;
  uses_pos: boolean;
  pos_provider_name: string | null;
  daily_pos_collection: number | null;
  international_card_acceptance_reason: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
