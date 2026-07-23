export interface DataProtectionActivity {
  id: string;
  processing_activity: string;
  data_category: string;
  purpose: string | null;
  legal_basis: string | null;
  retention_period: string | null;
  access_roles: string[];
  risk_level: string;
  review_date: string | null;
  created_at: string;
  updated_at: string;
}
