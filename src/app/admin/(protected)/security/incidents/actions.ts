'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { sendEmail } from '@/lib/email/resend';
import { SECURITY_INCIDENT_SEVERITIES, SECURITY_INCIDENT_STATUSES } from '@/data/securityIncidents';

const VALID_SEVERITIES = new Set<string>(SECURITY_INCIDENT_SEVERITIES.map((s) => s.value));
const VALID_STATUSES = new Set<string>(SECURITY_INCIDENT_STATUSES.map((s) => s.value));

export interface SecurityIncidentInput {
  title: string;
  severity: string;
  affectedSystems: string[];
  affectedUsers: string[];
}

export async function createSecurityIncident(input: SecurityIncidentInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('security_incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to open security incidents.' };
  }

  if (!input.title?.trim()) {
    return { success: false, message: 'Title is required.' };
  }
  if (!VALID_SEVERITIES.has(input.severity)) {
    return { success: false, message: 'Invalid severity.' };
  }

  const supabase = await createClient();
  const { data: incidentNumber } = await supabase.rpc('next_finance_number', { seq_prefix: 'SI' });

  const { data, error } = await supabase
    .from('security_incidents')
    .insert({
      incident_number: incidentNumber ?? null,
      title: input.title.trim(),
      severity: input.severity,
      status: 'open',
      affected_systems: input.affectedSystems,
      affected_users: input.affectedUsers,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create security incident', error);
    return { success: false, message: 'Failed to open security incident.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'security_incidents',
    recordId: data.id,
    newValue: { title: input.title, severity: input.severity },
  });

  const { data: settings } = await supabase.from('company_settings').select('incident_alert_email').eq('id', true).single();
  const recipient = settings?.incident_alert_email || process.env.BIZLINK_NOTIFICATION_EMAIL;
  if (recipient) {
    await sendEmail({
      to: recipient,
      subject: `Security incident opened: ${input.title}`,
      html: `<p>A new <strong>${input.severity}</strong> severity security incident was opened.</p><p>Title: ${input.title}</p>`,
      text: `A new ${input.severity} severity security incident was opened: ${input.title}`,
    });
  }

  revalidatePath('/admin/security/incidents');
  revalidatePath('/admin/security');
  return { success: true, id: data.id };
}

export async function updateSecurityIncidentStatus(
  id: string,
  status: string,
  note?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('security_incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update security incidents.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('security_incidents')
    .update({
      status,
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update security incident status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await supabase.from('security_incident_updates').insert({
    incident_id: id,
    note: note?.trim() || `Status changed to ${status}.`,
    status_at_update: status,
    created_by: user.email,
  });

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'security_incidents',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/security/incidents');
  revalidatePath(`/admin/security/incidents/${id}`);
  revalidatePath('/admin/security');
  return { success: true };
}

export async function addSecurityIncidentUpdate(id: string, note: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('security_incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update security incidents.' };
  }

  if (!note?.trim()) {
    return { success: false, message: 'A note is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('security_incident_updates').insert({
    incident_id: id,
    note: note.trim(),
    created_by: user.email,
  });

  if (error) {
    console.error('Failed to add security incident update', id, error);
    return { success: false, message: 'Failed to add update.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'add_timeline_update',
    module: 'security_incidents',
    recordId: id,
    newValue: { note },
  });

  revalidatePath(`/admin/security/incidents/${id}`);
  return { success: true };
}

export async function updateSecurityIncidentContainmentResolution(
  id: string,
  input: { containment?: string; resolution?: string; owner?: string }
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('security_incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update security incidents.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('security_incidents')
    .update({
      containment: input.containment?.trim() || null,
      resolution: input.resolution?.trim() || null,
      owner: input.owner?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update security incident containment/resolution', id, error);
    return { success: false, message: 'Failed to save.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_containment_resolution',
    module: 'security_incidents',
    recordId: id,
    newValue: input,
  });

  revalidatePath(`/admin/security/incidents/${id}`);
  return { success: true };
}
