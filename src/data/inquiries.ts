export const MERCHANT_SOLUTION_VALUE = 'merchant_payment_infrastructure' as const;

export const REQUESTED_SOLUTIONS = [
  { value: 'ai_sales_agent', label: 'AI Sales Agent' },
  { value: 'ai_customer_care_agent', label: 'AI Customer Care Agent' },
  { value: 'social_commerce_platform', label: 'Social Commerce Platform' },
  { value: 'payment_integration_support', label: 'Merchant Payment & Settlement Support' },
  { value: MERCHANT_SOLUTION_VALUE, label: 'Merchant Payment Infrastructure' },
  { value: 'website_landing_page', label: 'Website or Landing Page' },
  { value: 'other', label: 'Other' },
] as const;

export type RequestedSolution = (typeof REQUESTED_SOLUTIONS)[number]['value'];

// Preliminary, non-sensitive fields collected only when "Merchant Payment
// Infrastructure" is selected. No account numbers, wallet numbers, or KYC
// documents — that happens later through a protected onboarding workflow.
export const MERCHANT_BUSINESS_REGISTRATION_STATUSES = [
  { value: 'registered', label: 'Registered Business' },
  { value: 'in_process', label: 'Registration In Process' },
  { value: 'not_registered', label: 'Not Yet Registered' },
] as const;

export type MerchantBusinessRegistrationStatus = (typeof MERCHANT_BUSINESS_REGISTRATION_STATUSES)[number]['value'];

export const MERCHANT_BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail / Shop' },
  { value: 'ecommerce', label: 'E-Commerce / Online Store' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'restaurant_food', label: 'Restaurant / Food & Beverage' },
  { value: 'wholesale_distribution', label: 'Wholesale / Distribution' },
  { value: 'other', label: 'Other' },
] as const;

export type MerchantBusinessType = (typeof MERCHANT_BUSINESS_TYPES)[number]['value'];

export const MERCHANT_MONTHLY_VOLUME_RANGES = [
  { value: 'under_5m', label: 'Under TZS 5,000,000' },
  { value: '5m_20m', label: 'TZS 5,000,000 – 20,000,000' },
  { value: '20m_50m', label: 'TZS 20,000,000 – 50,000,000' },
  { value: '50m_200m', label: 'TZS 50,000,000 – 200,000,000' },
  { value: 'above_200m', label: 'Above TZS 200,000,000' },
] as const;

export type MerchantMonthlyVolumeRange = (typeof MERCHANT_MONTHLY_VOLUME_RANGES)[number]['value'];

export const MERCHANT_COLLECTION_METHODS = [
  { value: 'cash_only', label: 'Cash Only' },
  { value: 'mobile_money_manual', label: 'Mobile Money (Manual)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'existing_gateway', label: 'Existing Payment Gateway' },
  { value: 'mixed_multiple', label: 'Mixed / Multiple Methods' },
  { value: 'none_yet', label: 'None Yet' },
] as const;

export type MerchantCollectionMethod = (typeof MERCHANT_COLLECTION_METHODS)[number]['value'];

export const MERCHANT_GOLIVE_TIMELINES = [
  { value: 'immediately', label: 'Immediately' },
  { value: 'within_1_month', label: 'Within 1 Month' },
  { value: '1_3_months', label: '1 – 3 Months' },
  { value: '3_6_months', label: '3 – 6 Months' },
  { value: 'not_sure', label: 'Not Sure Yet' },
] as const;

export type MerchantGoLiveTimeline = (typeof MERCHANT_GOLIVE_TIMELINES)[number]['value'];

export const PREFERRED_CONTACT_METHODS = [
  { value: 'phone', label: 'Phone Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
] as const;

export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number]['value'];

export const INQUIRY_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_discussion', label: 'In Discussion' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'contract_review', label: 'Contract Review' },
  { value: 'offline_onboarding', label: 'Offline Onboarding' },
  { value: 'active_client', label: 'Active Client' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'dormant', label: 'Dormant' },
] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]['value'];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
] as const;

export const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export type Priority = (typeof PRIORITY_LEVELS)[number]['value'];

// Sales pipeline stage — deliberately separate from `status` above.
// `status` is the operational lifecycle (onboarding tracking, the
// Executive Management dashboard, and sidebar badges all key off its exact
// values) and stays untouched. `stage` is the new CRM sales-pipeline view
// of the same lead, with its own taxonomy.
export const LEAD_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'needs_assessment', label: 'Needs Assessment' },
  { value: 'proposal_preparation', label: 'Proposal Preparation' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'on_hold', label: 'On Hold' },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]['value'];

export const LEAD_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'walk_in', label: 'Walk-In' },
  { value: 'other', label: 'Other' },
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(
  list: readonly T[],
  value: string
): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export interface Inquiry {
  id: string;
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  business_type: string;
  location: string;
  requested_solution: RequestedSolution[];
  message: string | null;
  preferred_contact_method: PreferredContactMethod | null;
  status: InquiryStatus;
  admin_notes: string | null;
  notification_status: NotificationStatus;
  notification_error: string | null;
  consent_given: boolean;
  follow_up_date: string | null;
  last_contacted_at: string | null;
  assigned_to: string | null;
  priority: Priority;
  lead_number: string | null;
  stage: LeadStage;
  lead_score: number;
  lead_source: LeadSource | null;
  assigned_user_id: string | null;
  campaign_id: string | null;
  merchant_business_registration_status: MerchantBusinessRegistrationStatus | null;
  merchant_business_type: MerchantBusinessType | null;
  merchant_monthly_volume_range: MerchantMonthlyVolumeRange | null;
  merchant_current_collection_method: MerchantCollectionMethod | null;
  merchant_business_locations_count: number | null;
  merchant_golive_timeline: MerchantGoLiveTimeline | null;
  merchant_accuracy_confirmed: boolean;
  created_at: string;
  updated_at: string;
}
