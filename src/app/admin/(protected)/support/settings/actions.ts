'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export async function updateSlaRule(priority: string, responseHours: number, resolutionHours: number): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('support.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change support settings.' };
  }

  if (responseHours <= 0 || resolutionHours <= 0) {
    return { success: false, message: 'Hours must be greater than zero.' };
  }
  if (responseHours > resolutionHours) {
    return { success: false, message: 'Response deadline cannot be later than the resolution deadline.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('support_sla_rules')
    .update({ response_hours: responseHours, resolution_hours: resolutionHours })
    .eq('priority', priority);

  if (error) {
    console.error('Failed to update SLA rule', priority, error);
    return { success: false, message: 'Failed to save SLA rule.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'support_sla_rules',
    recordId: priority,
    newValue: { responseHours, resolutionHours },
  });

  revalidatePath('/admin/support/settings');
  return { success: true };
}

export async function setTicketCategoryActive(id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('support.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change support settings.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('support_ticket_categories').update({ is_active: isActive }).eq('id', id);

  if (error) {
    console.error('Failed to update ticket category', id, error);
    return { success: false, message: 'Failed to save ticket category.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: isActive ? 'activate' : 'deactivate',
    module: 'support_ticket_categories',
    recordId: id,
    newValue: { isActive },
  });

  revalidatePath('/admin/support/settings');
  return { success: true };
}

// Single-argument, string-in/string-out wrapper so InlineSelect (a Client
// Component) can bind it directly — onSave={setTicketCategoryActiveOption.bind(null, c.id)}
// — rather than being passed a plain arrow-function closure, which React
// rejects as a Client Component prop from a Server Component. InlineSelect
// always calls onSave with the raw option value ('true'/'false'), so the
// boolean conversion has to happen in here rather than at the call site.
export async function setTicketCategoryActiveOption(id: string, value: string): Promise<{ success: boolean; message?: string }> {
  return setTicketCategoryActive(id, value === 'true');
}

export async function updateEscalationRule(
  priority: string,
  escalateAfterHours: number,
  escalateToRole: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('support.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change support settings.' };
  }

  if (escalateAfterHours <= 0) {
    return { success: false, message: 'Escalation hours must be greater than zero.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('support_escalation_rules')
    .update({ escalate_after_hours: escalateAfterHours, escalate_to_role: escalateToRole })
    .eq('priority', priority);

  if (error) {
    console.error('Failed to update escalation rule', priority, error);
    return { success: false, message: 'Failed to save escalation rule.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'support_escalation_rules',
    recordId: priority,
    newValue: { escalateAfterHours, escalateToRole },
  });

  revalidatePath('/admin/support/settings');
  return { success: true };
}
