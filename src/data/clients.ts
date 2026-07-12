export const ONBOARDING_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number]['value'];

export const INTEGRATION_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'active', label: 'Active' },
  { value: 'issue', label: 'Issue' },
] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number]['value'];

export interface Client {
  id: string;
  lead_id: string | null;
  client_name: string;
  business_name: string;
  business_type: string | null;
  contact_person: string | null;
  email: string;
  phone: string;
  location: string | null;
  onboarding_status: OnboardingStatus;
  integration_status: IntegrationStatus;
  assigned_staff: string | null;
  is_active: boolean;
  internal_notes: string | null;
  date_joined: string;
  created_at: string;
  updated_at: string;
}

export const ONBOARDING_CHECKLIST_ITEMS = [
  { key: 'initial_consultation_done', label: 'Initial consultation done' },
  { key: 'business_details_confirmed', label: 'Business details confirmed' },
  { key: 'proposal_sent', label: 'Proposal sent' },
  { key: 'contract_signed', label: 'Contract signed' },
  { key: 'technical_requirements_collected', label: 'Technical requirements collected' },
  { key: 'payment_partner_onboarding_started', label: 'Payment partner onboarding started' },
  { key: 'system_setup_started', label: 'System setup started' },
  { key: 'testing_completed', label: 'Testing completed' },
  { key: 'client_training_completed', label: 'Client training completed' },
  { key: 'go_live_approved', label: 'Go-live approved' },
] as const;

export type OnboardingChecklistKey = (typeof ONBOARDING_CHECKLIST_ITEMS)[number]['key'];

export type OnboardingChecklist = {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
} & Record<OnboardingChecklistKey, boolean>;
