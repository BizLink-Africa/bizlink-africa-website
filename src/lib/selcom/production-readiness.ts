import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import type { ProductionReadinessCheckRow, ProductionReadinessEvidence } from './production-readiness-items';

export * from './production-readiness-items';

type ReadinessSupabaseClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

export async function getProductionReadinessChecks(supabase: ReadinessSupabaseClient): Promise<ProductionReadinessCheckRow[]> {
  const { data } = await supabase.from('selcom_production_readiness_checks').select('*').order('item_key', { ascending: true });
  return (data ?? []) as ProductionReadinessCheckRow[];
}

export async function getProductionReadinessEvidence(supabase: ReadinessSupabaseClient): Promise<ProductionReadinessEvidence> {
  const [balanceChecks, bankPayouts, walletPayouts, statusChecks, callbacksProcessed, callbacksDuplicate] = await Promise.all([
    supabase.from('selcom_balance_checks').select('id', { count: 'exact', head: true }).eq('query_succeeded', true),
    supabase.from('merchant_payouts').select('id', { count: 'exact', head: true }).eq('destination_type', 'bank_account').eq('status', 'successful'),
    supabase.from('merchant_payouts').select('id', { count: 'exact', head: true }).eq('destination_type', 'mobile_wallet').eq('status', 'successful'),
    supabase.from('merchant_payout_status_checks').select('id', { count: 'exact', head: true }).eq('query_succeeded', true),
    supabase.from('selcom_callback_events').select('id', { count: 'exact', head: true }).eq('outcome', 'processed'),
    supabase.from('selcom_callback_events').select('id', { count: 'exact', head: true }).eq('outcome', 'duplicate'),
  ]);

  return {
    balance_api_passed: balanceChecks.count ?? 0,
    bank_sandbox_payout_passed: bankPayouts.count ?? 0,
    mobile_wallet_sandbox_payout_passed: walletPayouts.count ?? 0,
    status_checking_passed: statusChecks.count ?? 0,
    callback_received_validated: callbacksProcessed.count ?? 0,
    // Idempotency and duplicate-detection share the same evidence signal
    // in this system — both are proven by the same guarded, replay-safe
    // code paths (see selcom-status-mapping.ts / process_selcom_callback's
    // duplicate guard) actually having fired at least once.
    duplicate_transaction_test_passed: callbacksDuplicate.count ?? 0,
  };
}
