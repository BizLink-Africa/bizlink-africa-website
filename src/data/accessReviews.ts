export const ACCESS_REVIEW_DECISIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'access_reduced_recommended', label: 'Access Reduction Recommended' },
  { value: 'revoke_recommended', label: 'Revocation Recommended' },
] as const;

export type AccessReviewDecision = (typeof ACCESS_REVIEW_DECISIONS)[number]['value'];

export interface AccessReview {
  id: string;
  staff_id: string | null;
  user_label: string;
  role_label: string | null;
  department: string | null;
  permissions_summary: string | null;
  reviewer: string | null;
  findings: string | null;
  excessive_access_flag: boolean;
  decision: AccessReviewDecision;
  review_date: string;
  next_review_date: string | null;
  created_at: string;
  updated_at: string;
}
