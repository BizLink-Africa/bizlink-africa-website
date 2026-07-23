'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

// Acknowledges a policy on the caller's own behalf only — staff_id is
// resolved server-side from the authenticated user, never taken from the
// client, so this can never be used to acknowledge on someone else's
// behalf. The RLS insert policy on policy_acknowledgements enforces the
// same constraint independently (staff_id must match auth.uid()'s own
// staff_profiles row) as a second, DB-level line of defense.
export async function acknowledgePolicy(policyId: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('policies.acknowledge');
  } catch {
    return { success: false, message: 'You do not have permission to acknowledge policies.' };
  }

  const supabase = await createClient();
  const { data: staff, error: staffError } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (staffError || !staff) {
    return { success: false, message: 'No active staff profile found for your account.' };
  }

  const { error } = await supabase.from('policy_acknowledgements').insert({
    policy_id: policyId,
    staff_id: staff.id,
  });

  if (error) {
    console.error('Failed to record policy acknowledgement', policyId, error);
    return { success: false, message: 'Failed to record acknowledgement.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'acknowledge',
    module: 'policy_acknowledgements',
    recordId: policyId,
  });

  revalidatePath('/admin/compliance/policy-acknowledgements');
  revalidatePath('/admin/compliance');
  return { success: true };
}
