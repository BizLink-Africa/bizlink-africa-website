import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import PrepareBatchForm from '@/components/admin/settlement/PrepareBatchForm';

export const dynamic = 'force-dynamic';

export default async function PrepareSettlementBatchPage() {
  try {
    await requirePermission('settlement.prepare');
  } catch {
    return <AccessDenied requiredPermission="settlement.prepare" />;
  }

  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Prepare New Settlement Batch</h1>
        <p className="text-sm text-[#707975] mt-1">
          Every merchant and transaction is checked against the 12 pre-settlement rules server-side — nothing is included on trust.
        </p>
      </div>
      <PrepareBatchForm merchants={merchantRows ?? []} />
    </div>
  );
}
