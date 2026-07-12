export const STAFF_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'sales_staff', label: 'Sales Staff' },
  { value: 'technical_staff', label: 'Technical Staff' },
  { value: 'support_staff', label: 'Support Staff' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number]['value'];

export interface Staff {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
