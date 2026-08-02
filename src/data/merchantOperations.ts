// Merchant Operations catalog: statuses, labels, and field options for the
// Merchant Applications / Merchant Profiles / KYC Coordination / Merchant
// Tills / Settlement Beneficiaries sidebar pages. No partner name, no
// rates/commissions, no account numbers are ever modeled here.

export const MERCHANT_ONBOARDING_STATUSES = [
  { value: 'application_received', label: 'Application Received' },
  { value: 'pre_screening', label: 'Pre-Screening' },
  { value: 'documents_incomplete', label: 'Documents Incomplete' },
  { value: 'submitted_to_partner', label: 'Submitted to Partner' },
  { value: 'kyc_under_review', label: 'KYC Under Review' },
  { value: 'additional_information_required', label: 'Additional Information Required' },
  { value: 'kyc_approved', label: 'KYC Approved' },
  { value: 'till_created', label: 'Till Created' },
  { value: 'settlement_setup_pending', label: 'Settlement Setup Pending' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
] as const;

export type MerchantOnboardingStatus = (typeof MERCHANT_ONBOARDING_STATUSES)[number]['value'];

export const MERCHANT_ONBOARDING_STATUS_COLORS: Record<string, string> = {
  application_received: 'bg-[#eeeeee] text-[#3f4945]',
  pre_screening: 'bg-[#eeeeee] text-[#3f4945]',
  documents_incomplete: 'bg-[#fbe4e4] text-[#8a1f1f]',
  submitted_to_partner: 'bg-[#e0f2ee] text-[#00342b]',
  kyc_under_review: 'bg-[#fef3e0] text-[#8a5a00]',
  additional_information_required: 'bg-[#fef3e0] text-[#8a5a00]',
  kyc_approved: 'bg-[#dcf5e3] text-[#1b7a3d]',
  till_created: 'bg-[#dcf5e3] text-[#1b7a3d]',
  settlement_setup_pending: 'bg-[#fef3e0] text-[#8a5a00]',
  active: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
  suspended: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export const MERCHANT_REGISTRATION_TYPES = [
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'limited_company', label: 'Limited Company' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'ngo', label: 'NGO' },
  { value: 'other', label: 'Other' },
] as const;

export const MERCHANT_RISK_STATUSES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

export const MERCHANT_RISK_COLORS: Record<string, string> = {
  low: 'bg-[#dcf5e3] text-[#1b7a3d]',
  medium: 'bg-[#fef3e0] text-[#8a5a00]',
  high: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export const MERCHANT_SETTLEMENT_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'active', label: 'Active' },
  { value: 'held', label: 'Held' },
] as const;

export const MERCHANT_EXPECTED_VOLUME_RANGES = [
  { value: 'under_5m', label: 'Under TZS 5,000,000' },
  { value: '5m_20m', label: 'TZS 5,000,000 – 20,000,000' },
  { value: '20m_50m', label: 'TZS 20,000,000 – 50,000,000' },
  { value: '50m_200m', label: 'TZS 50,000,000 – 200,000,000' },
  { value: 'above_200m', label: 'Above TZS 200,000,000' },
] as const;

export const MERCHANT_DOCUMENT_TYPES = [
  { value: 'certificate_of_incorporation', label: 'Certificate of Registration / Incorporation' },
  { value: 'business_licence', label: 'Business Licence' },
  { value: 'tin_certificate', label: 'TIN Certificate' },
  { value: 'owner_director_id', label: 'Owner/Director Identification' },
  { value: 'business_address', label: 'Business Address' },
  { value: 'contact_details', label: 'Contact Details' },
  { value: 'nature_of_business', label: 'Nature of Business' },
  { value: 'expected_transaction_volumes', label: 'Expected Transaction Volumes' },
  { value: 'settlement_beneficiary_information', label: 'Settlement Beneficiary Information' },
  { value: 'signed_merchant_agreement', label: 'Signed Merchant Agreement' },
  { value: 'data_processing_consent', label: 'Data-Processing Consent' },
  { value: 'additional_partner_requirement', label: 'Additional Partner Requirement' },
] as const;

// The one document type gated by an extra permission
// (merchant_kyc_identity_documents.view) at both the app layer and the
// storage.objects RLS policy — see the 20260807000000 migration.
export const IDENTITY_DOCUMENT_TYPE = 'owner_director_id';

export const MERCHANT_DOCUMENT_STATUSES = [
  { value: 'not_requested', label: 'Not Requested' },
  { value: 'requested', label: 'Requested' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'under_internal_review', label: 'Under Internal Review' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'ready_for_submission', label: 'Ready for Submission' },
  { value: 'submitted_to_partner', label: 'Submitted to Partner' },
  { value: 'additional_information_requested', label: 'Additional Information Requested' },
  { value: 'confirmed_by_partner', label: 'Confirmed by Partner' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
] as const;

export const MERCHANT_DOCUMENT_STATUS_COLORS: Record<string, string> = {
  not_requested: 'bg-[#eeeeee] text-[#3f4945]',
  requested: 'bg-[#eeeeee] text-[#3f4945]',
  uploaded: 'bg-[#e0f2ee] text-[#00342b]',
  under_internal_review: 'bg-[#fef3e0] text-[#8a5a00]',
  incomplete: 'bg-[#fbe4e4] text-[#8a1f1f]',
  ready_for_submission: 'bg-[#dcf5e3] text-[#1b7a3d]',
  submitted_to_partner: 'bg-[#e0f2ee] text-[#00342b]',
  additional_information_requested: 'bg-[#fef3e0] text-[#8a5a00]',
  confirmed_by_partner: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
  expired: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export const MERCHANT_MALWARE_SCAN_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'clean', label: 'Clean' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'skipped', label: 'Skipped' },
] as const;

// stage: what BizLink did (submitted to the partner, or logged that a
// response came back). partner_decision: the fact BizLink is recording
// about what the partner reported — never a decision BizLink itself makes.
export const MERCHANT_KYC_STAGES = [
  { value: 'submitted_to_partner', label: 'Submitted to Partner' },
  { value: 'partner_response_received', label: 'Partner Response Received' },
] as const;

export const MERCHANT_KYC_PARTNER_DECISIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved by Partner' },
  { value: 'rejected', label: 'Rejected by Partner' },
  { value: 'additional_information_required', label: 'Additional Information Required' },
] as const;

export const MERCHANT_TILL_STATUSES = [
  { value: 'requested', label: 'Requested' },
  { value: 'created', label: 'Created' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
] as const;

export const MERCHANT_TILL_STATUS_COLORS: Record<string, string> = {
  requested: 'bg-[#eeeeee] text-[#3f4945]',
  created: 'bg-[#e0f2ee] text-[#00342b]',
  active: 'bg-[#dcf5e3] text-[#1b7a3d]',
  suspended: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export const MERCHANT_BENEFICIARY_TYPES = [
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'mobile_wallet', label: 'Mobile Wallet' },
] as const;

export const MERCHANT_BENEFICIARY_VERIFICATION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'expired', label: 'Expired' },
] as const;

export const MERCHANT_BENEFICIARY_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[#eeeeee] text-[#3f4945]',
  under_review: 'bg-[#fef3e0] text-[#8a5a00]',
  verified: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
  suspended: 'bg-[#fbe4e4] text-[#8a1f1f]',
  expired: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

export const MERCHANT_BENEFICIARY_VERIFICATION_METHODS = [
  { value: 'partner_confirmation', label: 'Approved Partner Confirmation' },
  { value: 'micro_deposit', label: 'Micro-Deposit Verification' },
  { value: 'document_review', label: 'Document Review' },
  { value: 'selcom_account_lookup', label: 'Selcom Account Lookup' },
  { value: 'manual', label: 'Manual Verification' },
] as const;

// Institution codes for Selcom account lookups — sourced exclusively from
// selcom_institution_codes (seeded from official Selcom documentation,
// plus a distinct 'sandbox_test' category for the dummy test codes shown
// on BizLink's own Selcom sandbox dashboard — TESTBANK/TESTWALLET — which
// are account-specific and never appear in the public docs). This app
// never lets a code be typed freely or invented; see
// src/app/admin/(protected)/merchant-operations/beneficiaries/lookup-actions.ts.
export const SELCOM_INSTITUTION_CATEGORIES = [
  { value: 'bank', label: 'Bank' },
  { value: 'mobile_wallet', label: 'Mobile Wallet' },
  { value: 'selcom_internal', label: 'Selcom Internal Account' },
  { value: 'sandbox_test', label: 'Sandbox Test Account' },
] as const;

export interface SelcomInstitutionCode {
  code: string;
  name: string;
  category: 'bank' | 'mobile_wallet' | 'selcom_internal' | 'sandbox_test';
  is_active: boolean;
}

export interface MerchantBeneficiaryLookup {
  id: string;
  lookup_reference: string;
  merchant_id: string;
  beneficiary_id: string | null;
  institution_code: string;
  masked_account: string;
  returned_account_name: string | null;
  charges: unknown;
  total_charges: number | null;
  status: 'success' | 'failed';
  failure_reason: string | null;
  performed_by: string;
  performed_at: string;
  name_match_confirmed: boolean;
  name_match_reviewed_by: string | null;
  name_match_reviewed_at: string | null;
  name_match_notes: string | null;
}

export const MERCHANT_BENEFICIARY_CHANGE_REQUEST_TYPES = [
  { value: 'add', label: 'Add Beneficiary' },
  { value: 'change', label: 'Change Beneficiary' },
  { value: 'verify', label: 'Verify Beneficiary' },
  { value: 'suspend', label: 'Suspend Beneficiary' },
] as const;

export const MERCHANT_BENEFICIARY_REQUEST_STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-[#fef3e0] text-[#8a5a00]',
  approved: 'bg-[#dcf5e3] text-[#1b7a3d]',
  rejected: 'bg-[#fbe4e4] text-[#8a1f1f]',
};

// A beneficiary can only ever receive a payout when it is verified, not
// currently in its post-change cooling period, and not deactivated. This
// app has no real payout-execution integration to gate — there is nothing
// that actually moves money — so this is the honest, correctly-computed
// eligibility check itself, for any future payout feature to call.
export function isBeneficiaryPayable(beneficiary: {
  verification_status: string;
  cooling_period_ends_at: string | null;
  deactivated_at: string | null;
}): boolean {
  if (beneficiary.verification_status !== 'verified') return false;
  if (beneficiary.deactivated_at) return false;
  if (beneficiary.cooling_period_ends_at && new Date(beneficiary.cooling_period_ends_at) > new Date()) return false;
  return true;
}

export interface Merchant {
  id: string;
  business_name: string;
  trading_name: string | null;
  registration_type: string | null;
  tin: string | null;
  licence_number: string | null;
  business_category: string | null;
  contact_person_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  business_address: string | null;
  expected_volume: string | null;
  risk_status: string;
  onboarding_status: MerchantOnboardingStatus;
  partner_merchant_reference: string | null;
  till_reference: string | null;
  settlement_status: string;
  assigned_staff_id: string | null;
  compliance_hold: boolean;
  compliance_hold_reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MerchantStatusHistoryEntry {
  id: string;
  merchant_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_by: string;
  changed_at: string;
}

export interface MerchantNote {
  id: string;
  merchant_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface MerchantDocument {
  id: string;
  merchant_id: string;
  document_type: string;
  status: string;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface MerchantKycReview {
  id: string;
  merchant_id: string;
  stage: string;
  partner_decision: string | null;
  partner_reference: string | null;
  notes: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface MerchantTill {
  id: string;
  merchant_id: string;
  status: string;
  partner_till_reference: string | null;
  requested_at: string;
  created_at_partner: string | null;
  notes: string | null;
  created_by: string;
  updated_at: string;
}

export interface MerchantDocumentFile {
  id: string;
  merchant_id: string;
  document_type: string;
  version_number: number;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  is_current: boolean;
  malware_scan_status: string;
  uploaded_by: string;
  uploaded_at: string;
  retention_expires_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
}

export interface MerchantDataProcessingConsent {
  id: string;
  merchant_id: string;
  consent_given: boolean;
  consent_text_version: string;
  recorded_by: string;
  recorded_at: string;
}

export interface MerchantSettlementBeneficiary {
  id: string;
  merchant_id: string;
  destination_type: string;
  account_holder_name: string;
  bank_or_network_name: string | null;
  bank_or_network_code: string | null;
  // encrypted_destination_value is intentionally never selected by any
  // page — it is not modeled here so a stray `select('*')` cast can't
  // accidentally type it as readable app data.
  masked_destination_value: string;
  verification_status: string;
  verification_method: string | null;
  is_primary: boolean;
  verified_at: string | null;
  verified_by: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
  change_reason: string | null;
  cooling_period_ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MerchantBeneficiaryChangeRequest {
  id: string;
  merchant_id: string;
  beneficiary_id: string | null;
  request_type: string;
  proposed_destination_type: string | null;
  proposed_account_holder_name: string | null;
  proposed_bank_or_network_name: string | null;
  proposed_bank_or_network_code: string | null;
  proposed_masked_value: string | null;
  proposed_verification_method: string | null;
  proposed_is_primary: boolean | null;
  change_reason: string;
  status: string;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  supporting_lookup_id: string | null;
}
