'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '@/data/technicalIncidents';

const VALID_SEVERITIES = new Set<string>(INCIDENT_SEVERITIES.map((s) => s.value));
const VALID_STATUSES = new Set<string>(INCIDENT_STATUSES.map((s) => s.value));

export interface IncidentInput {
  title: string;
  severity: string;
  affectedSystems: string[];
  affectedClients: string[];
}

export async function createIncident(input: IncidentInput): Promise<{ success: boolean; message?: string; id?: string }> {
  let user;
  try {
    user = await requirePermission('incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to open incidents.' };
  }

  if (!input.title?.trim()) {
    return { success: false, message: 'Title is required.' };
  }
  if (!VALID_SEVERITIES.has(input.severity)) {
    return { success: false, message: 'Invalid severity.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('technical_incidents')
    .insert({
      title: input.title.trim(),
      severity: input.severity,
      status: 'open',
      affected_systems: input.affectedSystems,
      affected_clients: input.affectedClients,
      created_by: user.email,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to create incident', error);
    return { success: false, message: 'Failed to open incident.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'technical_incidents',
    recordId: data.id,
    newValue: input,
  });

  revalidatePath('/admin/technical-incidents');
  revalidatePath('/admin/cto');
  return { success: true, id: data.id };
}

// Status transitions always write a timeline entry — an incident's status
// history must never be silently overwritten by a plain field edit, or the
// timeline (a required field) would drift from what actually happened.
export async function updateIncidentStatus(
  id: string,
  status: string,
  note?: string
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update incident status.' };
  }

  if (!VALID_STATUSES.has(status)) {
    return { success: false, message: 'Invalid status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('technical_incidents')
    .update({
      status,
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update incident status', id, error);
    return { success: false, message: 'Failed to update status.' };
  }

  await supabase.from('technical_incident_updates').insert({
    incident_id: id,
    note: note?.trim() || `Status changed to ${status}.`,
    status_at_update: status,
    created_by: user.email,
  });

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_status',
    module: 'technical_incidents',
    recordId: id,
    newValue: { status },
  });

  revalidatePath('/admin/technical-incidents');
  revalidatePath(`/admin/technical-incidents/${id}`);
  revalidatePath('/admin/cto');
  return { success: true };
}

export async function addIncidentUpdate(id: string, note: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update incidents.' };
  }

  if (!note?.trim()) {
    return { success: false, message: 'A note is required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('technical_incident_updates').insert({
    incident_id: id,
    note: note.trim(),
    created_by: user.email,
  });

  if (error) {
    console.error('Failed to add incident update', id, error);
    return { success: false, message: 'Failed to add update.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'add_timeline_update',
    module: 'technical_incidents',
    recordId: id,
    newValue: { note },
  });

  revalidatePath(`/admin/technical-incidents/${id}`);
  return { success: true };
}

export async function updateIncidentRootCauseResolution(
  id: string,
  input: { rootCause?: string; resolution?: string }
): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('incidents.manage');
  } catch {
    return { success: false, message: 'You do not have permission to update incidents.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('technical_incidents')
    .update({
      root_cause: input.rootCause?.trim() || null,
      resolution: input.resolution?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update incident root cause/resolution', id, error);
    return { success: false, message: 'Failed to save.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update_root_cause_resolution',
    module: 'technical_incidents',
    recordId: id,
    newValue: input,
  });

  revalidatePath(`/admin/technical-incidents/${id}`);
  return { success: true };
}
