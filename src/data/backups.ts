export const BACKUP_TYPES = [
  { value: 'automated', label: 'Automated' },
  { value: 'manual', label: 'Manual' },
] as const;

export type BackupType = (typeof BACKUP_TYPES)[number]['value'];

export const BACKUP_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const;

export type BackupStatus = (typeof BACKUP_STATUSES)[number]['value'];

export interface BackupRecord {
  id: string;
  system: string;
  backup_type: BackupType;
  status: BackupStatus;
  started_at: string | null;
  completed_at: string | null;
  size_mb: number | null;
  location: string | null;
  next_scheduled_at: string | null;
  created_at: string;
}
