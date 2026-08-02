import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import OpenCaseForm from '@/components/admin/chargebacks/OpenCaseForm';

export const dynamic = 'force-dynamic';

export default async function NewChargebackCasePage() {
  try {
    await requirePermission('chargebacks.manage');
  } catch {
    return <AccessDenied requiredPermission="chargebacks.manage" />;
  }

  const supabase = await createClient();
  const { data: transactionRows } = await supabase
    .from('collection_transactions')
    .select('id, provider_transaction_reference, gross_amount')
    .neq('chargeback_status', 'chargeback_confirmed')
    .order('collected_at', { ascending: false })
    .limit(500);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Open Chargeback Case</h1>
        <p className="text-sm text-[#707975] mt-1">Opening a case immediately marks the underlying transaction as disputed.</p>
      </div>
      <OpenCaseForm transactions={transactionRows ?? []} />
    </div>
  );
}
