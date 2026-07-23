export const JOB_STATUSES = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'retrying', label: 'Retrying' },
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number]['value'];

export interface BackgroundJob {
  id: string;
  job_name: string;
  queue: string;
  status: JobStatus;
  started_at: string | null;
  completed_at: string | null;
  retries: number;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}
