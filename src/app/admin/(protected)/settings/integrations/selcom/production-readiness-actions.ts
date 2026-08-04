'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { hasRecentReauth, SELCOM_INTEGRATION_REAUTH_PURPOSE } from '@/lib/supabase/reauth';
import { PRODUCTION_READINESS_ITEM_KEYS, type ChecklistItemStatus } from '@/lib/selcom/production-readiness-items';
import { assertArchivedFinancialPrototypeReadOnly } from '@/lib/archived-financial-prototype';

const PAGE_PATH = '/admin/settings/integrations/selcom/production-readiness';

interface ActionResult {
  success: boolean;
  message?: string;
}

// "Environment changes require Super Admin re-authentication" / "require
// a reason": nothing in this file can itself flip SELCOM_ENV (that stays
// a Vercel-level deployment change, outside this app's control — see
// config.ts's resolveSelcomEnvironment()), but authorize/deauthorize is
// the closest thing this app has to "an environment change" — the DB-side
// record that a human has decided production is (or is no longer) ready.
// Finance and Compliance approval, being the final human sign-offs that
// gate authorization, get the same reauth + reason treatment. Individual
// checklist item attestations (20 of them) do not require reauth each —
// that would make routine QA work unusable — but every mutation here is
// still audit-logged, regardless.

// Marks one checklist item passed/failed/not_applicable/not_started.
// Never itself claims a test passed — it only records what a human with
// selcom_production.manage_checklist attests to.
export async function setProductionReadinessCheck(itemKey: string, status: ChecklistItemStatus, notes: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('selcom_production.manage_checklist');
  } catch {
    return { success: false, message: 'You do not have permission to manage the production readiness checklist.' };
  }
  if (!PRODUCTION_READINESS_ITEM_KEYS.includes(itemKey)) {
    return { success: false, message: 'Unknown checklist item.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_selcom_production_readiness_check', {
    p_item_key: itemKey,
    p_status: status,
    p_notes: notes?.trim() || null,
    p_performed_by: user.email ?? 'unknown',
  });
  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'production_readiness_check',
    module: 'selcom_integration',
    recordId: itemKey,
    newValue: { itemKey, status, notes },
  });

  revalidatePath(PAGE_PATH);
  return { success: true };
}

async function recordApproval(
  kind: 'finance' | 'compliance',
  approved: boolean,
  reason: string
): Promise<ActionResult> {
  const permission = kind === 'finance' ? 'selcom_production.approve_finance' : 'selcom_production.approve_compliance';
  let user;
  try {
    user = await requirePermission(permission);
  } catch {
    return { success: false, message: `You do not have permission to record ${kind} approval.` };
  }
  if (!(await hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before recording this approval.' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, message: 'A reason is required.' };
  }

  const supabase = await createClient();
  const rpcName = kind === 'finance' ? 'record_selcom_production_finance_approval' : 'record_selcom_production_compliance_approval';
  const { error } = await supabase.rpc(rpcName, {
    p_approved: approved,
    p_reason: reason.trim(),
    p_performed_by: user.email ?? 'unknown',
  });
  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: approved ? `${kind}_approval_recorded` : `${kind}_approval_revoked`,
    module: 'selcom_integration',
    newValue: { approved, reason: reason.trim() },
  });

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function recordFinanceApproval(approved: boolean, reason: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  return recordApproval('finance', approved, reason);
}

export async function recordComplianceApproval(approved: boolean, reason: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  return recordApproval('compliance', approved, reason);
}

// The final DB-side gate — see the migration's authorize_selcom_production_
// activation(), which independently re-verifies every checklist item and
// both approvals server-side (never trusts this action's own view of that
// state). Does NOT make production live: see config.ts's header comment.
export async function authorizeProductionActivation(reason: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('selcom_production.authorize');
  } catch {
    return { success: false, message: 'You do not have permission to authorize production activation.' };
  }
  if (!(await hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before authorizing production activation.' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, message: 'A reason is required to authorize production activation.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('authorize_selcom_production_activation', {
    p_reason: reason.trim(),
    p_performed_by: user.email ?? 'unknown',
  });
  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'production_activation_authorized',
    module: 'selcom_integration',
    newValue: { reason: reason.trim() },
  });

  revalidatePath(PAGE_PATH);
  return {
    success: true,
    message:
      'Authorization recorded. This does not make production live by itself — that additionally requires setting ' +
      'SELCOM_ENV=production and SELCOM_PRODUCTION_ACTIVATION_ENABLED=true on the authorised production deployment, ' +
      'a separate, deliberate change outside this app.',
  };
}

export async function deauthorizeProductionActivation(reason: string): Promise<ActionResult> {
  try {
    await assertArchivedFinancialPrototypeReadOnly();
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
  let user;
  try {
    user = await requirePermission('selcom_production.authorize');
  } catch {
    return { success: false, message: 'You do not have permission to de-authorize production activation.' };
  }
  if (!(await hasRecentReauth(SELCOM_INTEGRATION_REAUTH_PURPOSE))) {
    return { success: false, message: 'Please re-confirm your password before de-authorizing production activation.' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, message: 'A reason is required to de-authorize production activation.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('deauthorize_selcom_production_activation', {
    p_reason: reason.trim(),
    p_performed_by: user.email ?? 'unknown',
  });
  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'production_activation_deauthorized',
    module: 'selcom_integration',
    newValue: { reason: reason.trim() },
  });

  revalidatePath(PAGE_PATH);
  return { success: true };
}
