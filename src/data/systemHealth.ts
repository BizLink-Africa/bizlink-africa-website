export const HEALTH_STATUSES = [
  { value: 'operational', label: 'Operational' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number]['value'];

export const SYSTEM_COMPONENTS = [
  { value: 'application', label: 'Application' },
  { value: 'database', label: 'Database' },
  { value: 'queue', label: 'Queue' },
  { value: 'cache', label: 'Cache' },
  { value: 'storage', label: 'Storage' },
  { value: 'scheduled_jobs', label: 'Scheduled Jobs' },
] as const;

export type SystemComponent = (typeof SYSTEM_COMPONENTS)[number]['value'];

export interface SystemHealthCheck {
  id: string;
  component: SystemComponent;
  status: HealthStatus;
  error_rate_percentage: number | null;
  detail: string | null;
  checked_at: string;
  updated_at: string;
}
