export const DEPARTMENT_NAMES = [
  'Executive',
  'Finance',
  'Technology',
  'Operations',
  'Marketing',
  'Customer Support',
  'Compliance & Security',
  'Administration',
] as const;

export const DEPARTMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export type DepartmentStatus = (typeof DEPARTMENT_STATUSES)[number]['value'];

export function labelForStatus(value: string): string {
  return DEPARTMENT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export interface Department {
  id: string;
  name: string;
  manager: string | null;
  description: string | null;
  status: DepartmentStatus;
  created_at: string;
  updated_at: string;
}
