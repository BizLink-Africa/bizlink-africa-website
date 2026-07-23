export const INCIDENT_SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]['value'];

export const INCIDENT_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]['value'];

export const OPEN_INCIDENT_STATUSES: IncidentStatus[] = ['open', 'investigating', 'identified', 'monitoring'];

export interface TechnicalIncident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affected_systems: string[];
  affected_clients: string[];
  root_cause: string | null;
  resolution: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  note: string;
  status_at_update: string | null;
  created_by: string | null;
  created_at: string;
}
