export const DEPLOYMENT_ENVIRONMENTS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'sandbox', label: 'Sandbox' },
] as const;

export const DEPLOYMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'rolled_back', label: 'Rolled Back' },
] as const;

export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number]['value'];

export const ROLLBACK_STATUSES = [
  { value: 'not_required', label: 'Not Required' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const;

export type RollbackStatus = (typeof ROLLBACK_STATUSES)[number]['value'];

export interface Deployment {
  id: string;
  application: string;
  environment: string;
  version: string;
  status: DeploymentStatus;
  started_by: string | null;
  start_time: string | null;
  end_time: string | null;
  result: string | null;
  rollback_status: RollbackStatus;
  created_at: string;
  updated_at: string;
}
