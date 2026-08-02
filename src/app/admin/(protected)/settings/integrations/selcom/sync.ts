import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';
import { getSelcomIntegrationStatus } from '@/lib/selcom/status';

// Detects drift in the externally-managed (Vercel) Selcom env vars and logs
// it, even though this app never performs the change itself. Called once
// per page view (see page.tsx) — safe to call repeatedly: the underlying
// RPC only ever reports something "changed" the first time a real change
// is observed after the last sync, so re-rendering the page twice in a row
// with no real change produces no duplicate log entries.
//
// 'system' is used as the performer for these three log entries
// specifically because they describe something that happened OUTSIDE this
// app (someone edited an env var in Vercel) — attributing it to whichever
// staff member happened to load the page next would be misleading.
const SYSTEM_PERFORMER = 'system';

interface SyncResultRow {
  is_first_observation: boolean;
  environment_changed: boolean;
  credential_changed: boolean;
  callback_changed: boolean;
}

export async function syncSelcomConfigurationSnapshot(): Promise<void> {
  const status = getSelcomIntegrationStatus();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('sync_selcom_configuration_snapshot', {
    p_environment: status.environmentRaw,
    p_api_key_fingerprint: status.maskedApiKey ?? '(unset)',
    p_disbursement_account_fingerprint: status.maskedDisbursementAccount ?? '(unset)',
    p_callback_configured: status.callbackConfigured,
  });

  // Non-fatal — the page still renders an accurate status from live env
  // vars regardless; this only affects drift *logging*, and a viewer
  // without integrations.selcom.view (who'd get a permission error from
  // the RPC) never reaches this call in the first place (see page.tsx's
  // requirePermission gate, which runs first).
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    if (error) console.error('Failed to sync Selcom configuration snapshot', error);
    return;
  }

  const result = data[0] as SyncResultRow;
  if (result.is_first_observation) return;

  if (result.environment_changed) {
    await logAuditEvent({
      performedBy: SYSTEM_PERFORMER,
      actionType: 'environment_change',
      module: 'selcom_integration',
      newValue: { environment: status.environmentRaw },
    });
  }
  if (result.credential_changed) {
    await logAuditEvent({
      performedBy: SYSTEM_PERFORMER,
      actionType: 'credential_configuration_change',
      module: 'selcom_integration',
      // Masked values only — never the underlying key/account number.
      newValue: { maskedApiKey: status.maskedApiKey, maskedDisbursementAccount: status.maskedDisbursementAccount },
    });
  }
  if (result.callback_changed) {
    await logAuditEvent({
      performedBy: SYSTEM_PERFORMER,
      actionType: 'callback_configuration_change',
      module: 'selcom_integration',
      newValue: { callbackConfigured: status.callbackConfigured },
    });
  }
}
