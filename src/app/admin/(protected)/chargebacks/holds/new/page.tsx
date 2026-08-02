import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import PlaceHoldForm from '@/components/admin/chargebacks/PlaceHoldForm';

export const dynamic = 'force-dynamic';

export default async function NewSettlementHoldPage() {
  try {
    await requirePermission('holds.manage');
  } catch {
    return <AccessDenied requiredPermission="holds.manage" />;
  }

  const supabase = await createClient();
  const [{ data: merchantRows }, { data: transactionRows }] = await Promise.all([
    supabase.from('merchants').select('id, business_name').order('business_name'),
    supabase.from('collection_transactions').select('id, provider_transaction_reference, merchant_id').is('settlement_batch_id', null).order('collected_at', { ascending: false }).limit(500),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Place Settlement Hold</h1>
        <p className="text-sm text-[#707975] mt-1">
          A blanket hold blocks every future settlement batch for this merchant; a transaction hold blocks only that transaction.
        </p>
      </div>
      <PlaceHoldForm merchants={merchantRows ?? []} transactions={transactionRows ?? []} />
    </div>
  );
}
