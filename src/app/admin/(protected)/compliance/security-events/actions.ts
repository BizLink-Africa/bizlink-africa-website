'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import type { SecurityEventType, SecuritySeverity } from '@/data/compliance';

const MAX_TEXT_LENGTH = 200;

export interface SecurityEventInput {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  actor?: string;
  ipAddress?: string;
  device?: string;
  result?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function logSecurityEvent(input: SecurityEventInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('security.manage');
  } catch {
    return { success: false, message: 'You do not have permission to log security events.' };
  }

  if (!isNonEmptyString(input.description)) {
    return { success: false, message: 'Description is required.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('security_events')
    .insert({
      event_type: input.eventType,
      severity: input.severity,
      description: input.description.trim().slice(0, MAX_TEXT_LENGTH),
      actor: input.actor?.trim() || null,
      ip_address: input.ipAddress?.trim() || null,
      device: input.device?.trim() || null,
      result: input.result?.trim() || null,
      status: 'open',
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to log security event', error);
    return { success: false, message: 'Failed to log security event.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'security_events',
    recordId: data.id,
    newValue: { eventType: input.eventType, severity: input.severity },
  });

  revalidatePath('/admin/compliance/security-events');
  revalidatePath('/admin/compliance');
  return { success: true, id: data.id };
}

export async function resolveSecurityEvent(
  id: string,
  status: 'investigating' | 'resolved' | 'false_positive'
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('security.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update security events.' };
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { status };
  if (status === 'resolved' || status === 'false_positive') {
    updates.resolved_by = user.email;
    updates.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase.from('security_events').update(updates).eq('id', id);

  if (error) {
    console.error('Failed to update security event', id, error);
    return { success: false, message: 'Failed to update security event.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: `status_${status}`,
    module: 'security_events',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/compliance/security-events');
  revalidatePath('/admin/compliance');
  return { success: true };
}
