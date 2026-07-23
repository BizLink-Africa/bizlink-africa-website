export const POLICY_CATEGORIES = [
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'security', label: 'Security' },
  { value: 'data_protection', label: 'Data Protection' },
  { value: 'operations', label: 'Operations' },
  { value: 'other', label: 'Other' },
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number]['value'];

export const POLICY_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

export type PolicyStatus = (typeof POLICY_STATUSES)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export interface Policy {
  id: string;
  title: string;
  category: PolicyCategory;
  version: string;
  status: PolicyStatus;
  effective_date: string | null;
  review_date: string | null;
  owner: string | null;
  content: string | null;
  file_url: string | null;
  acknowledgement_required: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
}

export interface Permission {
  id: string;
  module: string;
  description: string | null;
}
