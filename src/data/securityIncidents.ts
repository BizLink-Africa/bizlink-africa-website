export const SECURITY_INCIDENT_SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export type SecurityIncidentSeverity = (typeof SECURITY_INCIDENT_SEVERITIES)[number]['value'];

export const SECURITY_INCIDENT_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'contained', label: 'Contained' },
  { value: 'resolved', label: 'Resolved' },
] as const;

export type SecurityIncidentStatus = (typeof SECURITY_INCIDENT_STATUSES)[number]['value'];

export const OPEN_SECURITY_INCIDENT_STATUSES: SecurityIncidentStatus[] = ['open', 'investigating', 'contained'];

export interface SecurityIncident {
  id: string;
  incident_number: string | null;
  title: string;
  severity: SecurityIncidentSeverity;
  status: SecurityIncidentStatus;
  affected_systems: string[];
  affected_users: string[];
  detection_date: string;
  owner: string | null;
  containment: string | null;
  resolution: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SecurityIncidentUpdate {
  id: string;
  incident_id: string;
  note: string;
  status_at_update: string | null;
  created_by: string | null;
  created_at: string;
}
