export const ONBOARDING_STAGES = [
  { value: 'new_inquiry', label: 'New Inquiry' },
  { value: 'initial_contact', label: 'Initial Contact' },
  { value: 'needs_assessment', label: 'Needs Assessment' },
  { value: 'proposal_preparation', label: 'Proposal Preparation' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'documents_pending', label: 'Documents Pending' },
  { value: 'documents_received', label: 'Documents Received' },
  { value: 'compliance_review', label: 'Compliance Review' },
  { value: 'contract_preparation', label: 'Contract Preparation' },
  { value: 'contract_review', label: 'Contract Review' },
  { value: 'contract_approval', label: 'Contract Approval' },
  { value: 'contract_signature', label: 'Contract Signature' },
  { value: 'technical_setup', label: 'Technical Setup' },
  { value: 'integration_testing', label: 'Integration Testing' },
  { value: 'client_provisioning', label: 'Client Provisioning' },
  { value: 'training_and_handover', label: 'Training and Handover' },
  { value: 'activated', label: 'Activated' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number]['value'];

// Stages that count as "done" for pipeline purposes — excluded from
// pending/overdue counts on the Operations Dashboard.
export const CLOSED_ONBOARDING_STAGES: OnboardingStage[] = ['activated', 'rejected'];

export const ONBOARDING_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

export type OnboardingPriority = (typeof ONBOARDING_PRIORITIES)[number]['value'];

export interface OnboardingCase {
  id: string;
  case_number: string;
  client_id: string | null;
  lead_id: string | null;
  stage: OnboardingStage;
  priority: OnboardingPriority;
  assigned_user_id: string | null;
  due_date: string | null;
  notes: string | null;
  blockers: string | null;
  document_references: string[];
  related_contract_id: string | null;
  related_proforma_id: string | null;
  related_invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const PROJECT_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]['value'];

export interface Project {
  id: string;
  project_number: string;
  project_name: string;
  client_id: string | null;
  service_key: string | null;
  contract_id: string | null;
  project_owner: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_completion_date: string | null;
  completion_date: string | null;
  progress: number;
  risks: string | null;
  blockers: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTeamMember {
  id: string;
  project_id: string;
  staff_id: string;
  role_on_project: string | null;
  created_at: string;
}

export const MILESTONE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'blocked', label: 'Blocked' },
] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]['value'];

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  completion_date: string | null;
  status: MilestoneStatus;
  dependencies: string[];
  acceptance_requirement: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const PROVISIONING_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
] as const;

export type ProvisioningStatus = (typeof PROVISIONING_STATUSES)[number]['value'];

export interface ClientProvisioning {
  id: string;
  client_id: string;
  enabled_modules: string[];
  integration_metadata: Record<string, unknown>;
  technical_owner: string | null;
  activation_date: string | null;
  training_status: ProvisioningStatus;
  handover_status: ProvisioningStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CREDENTIAL_TYPES = [
  { value: 'api_key', label: 'API Key' },
  { value: 'api_secret', label: 'API Secret' },
  { value: 'webhook_secret', label: 'Webhook Secret' },
  { value: 'webhook_url', label: 'Webhook URL' },
  { value: 'other', label: 'Other' },
] as const;

export type CredentialType = (typeof CREDENTIAL_TYPES)[number]['value'];

// Masked shape only — this app never reads secret_value_encrypted back.
export interface ProvisioningCredential {
  id: string;
  provisioning_id: string;
  credential_type: CredentialType;
  label: string;
  masked_preview: string;
  created_by: string | null;
  created_at: string;
}

export const TASK_STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number]['value'];

export const TASK_PRIORITIES = ONBOARDING_PRIORITIES;
export type TaskPriority = OnboardingPriority;

export interface OperationalTask {
  id: string;
  task_number: string;
  title: string;
  description: string | null;
  client_id: string | null;
  project_id: string | null;
  contract_id: string | null;
  assigned_user_id: string | null;
  department: string | null;
  priority: TaskPriority;
  due_date: string | null;
  status: TaskStatus;
  blocker: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceAllocation {
  id: string;
  staff_id: string;
  project_id: string | null;
  allocation_percent: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}
