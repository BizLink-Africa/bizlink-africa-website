'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { sendEmail } from '@/lib/email/resend';
import { ACCESS_REVIEW_DECISIONS } from '@/data/accessReviews';

const VALID_DECISIONS = new Set<string>(ACCESS_REVIEW_DECISIONS.map((d) => d.value));

export interface AccessReviewInput {
  staffId?: string;
  userLabel: string;
  roleLabel?: string;
  department?: string;
  permissionsSummary?: string;
  findings?: string;
  excessiveAccessFlag: boolean;
  reviewDate?: string;
  nextReviewDate?: string;
}

// Deliberately writes ONLY to access_reviews — never to
// roles/role_permissions/staff_profiles. Recording a review (even one
// flagging excessive access) is a documented recommendation, not a role
// mutation; actually changing someone's role/permissions still requires
// roles.manage/users.manage on the Staff & Roles page, which
// compliance_security does not hold. See
// cto/technology-permissions.test.ts's sibling test for this module for the
// automated check.
export async function createAccessReview(input: AccessReviewInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('access_reviews.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record access reviews.' };
  }

  if (!input.userLabel?.trim()) {
    return { success: false, message: 'A user is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('access_reviews')
    .insert({
      staff_id: input.staffId || null,
      user_label: input.userLabel.trim(),
      role_label: input.roleLabel?.trim() || null,
      department: input.department?.trim() || null,
      permissions_summary: input.permissionsSummary?.trim() || null,
      reviewer: user.email,
      findings: input.findings?.trim() || null,
      excessive_access_flag: input.excessiveAccessFlag,
      decision: 'pending',
      review_date: input.reviewDate || undefined,
      next_review_date: input.nextReviewDate || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create access review', error);
    return { success: false, message: 'Failed to create access review.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'access_reviews',
    recordId: data.id,
    newValue: { userLabel: input.userLabel, excessiveAccessFlag: input.excessiveAccessFlag },
  });

  if (input.excessiveAccessFlag) {
    const { data: settings } = await supabase.from('company_settings').select('compliance_alert_email').eq('id', true).single();
    const recipient = settings?.compliance_alert_email || process.env.BIZLINK_NOTIFICATION_EMAIL;
    if (recipient) {
      await sendEmail({
        to: recipient,
        subject: `Excessive access flagged: ${input.userLabel}`,
        html: `<p>An access review flagged <strong>${input.userLabel}</strong> for excessive access.</p><p>Findings: ${input.findings ?? 'None recorded'}</p>`,
        text: `An access review flagged ${input.userLabel} for excessive access. Findings: ${input.findings ?? 'None recorded'}`,
      });
    }
  }

  revalidatePath('/admin/compliance/access-reviews');
  revalidatePath('/admin/compliance');
  return { success: true, id: data.id };
}

// Recording a decision is itself the auditable event this module exists
// for ("access-review decisions are logged") — every call writes an
// audit_logs row, regardless of which decision was chosen.
export async function recordAccessReviewDecision(
  id: string,
  decision: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('access_reviews.manage');
  } catch {
    return { success: false, message: 'You do not have permission to record access review decisions.' };
  }

  if (!VALID_DECISIONS.has(decision)) {
    return { success: false, message: 'Invalid decision.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('access_reviews').update({ decision }).eq('id', id);

  if (error) {
    console.error('Failed to record access review decision', id, error);
    return { success: false, message: 'Failed to record decision.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'decision',
    module: 'access_reviews',
    recordId: id,
    newValue: { decision },
  });

  revalidatePath('/admin/compliance/access-reviews');
  return { success: true };
}
