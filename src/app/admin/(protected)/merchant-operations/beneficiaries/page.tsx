import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { MERCHANT_BENEFICIARY_CHANGE_REQUEST_TYPES, type MerchantBeneficiaryChangeRequest } from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

// This page never queries masked_destination_value or any beneficiary
// field at all — it only links into the reauth-gated per-merchant
// workspace, which is the only place beneficiary detail (masked) is ever
// rendered.
export default async function SettlementBeneficiariesPage() {
  try {
    await requirePermission('merchant_beneficiaries.view');
  } catch {
    return <AccessDenied requiredPermission="merchant_beneficiaries.view" />;
  }

  const supabase = await createClient();
  const [{ data: merchantRows }, { data: pendingRows }] = await Promise.all([
    supabase.from('merchants').select('id, business_name').order('business_name'),
    supabase
      .from('merchant_beneficiary_change_requests')
      .select('id, merchant_id, request_type, requested_by, requested_at')
      .eq('status', 'pending_approval')
      .order('requested_at', { ascending: false })
      .limit(50),
  ]);

  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));
  const pending = (pendingRows ?? []) as Pick<MerchantBeneficiaryChangeRequest, 'id' | 'merchant_id' | 'request_type' | 'requested_by' | 'requested_at'>[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Settlement Beneficiaries</h1>
        <p className="text-sm text-[#707975] mt-1">
          Account and wallet numbers are never shown here — open a merchant to view masked details (requires
          re-authentication).
        </p>
      </div>

      {pending.length > 0 && (
        <div className="mb-6 bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-1">Pending Approval</h2>
          <p className="text-xs text-[#707975] mb-4">{pending.length} change request{pending.length === 1 ? '' : 's'} awaiting a different reviewer.</p>
          <ul className="divide-y divide-[#efeded]">
            {pending.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <Link href={`/admin/merchant-operations/beneficiaries/${r.merchant_id}`} className="font-medium text-[#00342b] hover:underline">
                    {merchantNameById.get(r.merchant_id) ?? 'Unknown merchant'}
                  </Link>
                  <span className="text-xs text-[#707975] ml-2">{labelFor(MERCHANT_BENEFICIARY_CHANGE_REQUEST_TYPES, r.request_type)} · requested by {r.requested_by}</span>
                </div>
                <span className="text-xs text-[#707975]">{new Date(r.requested_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border border-[#bfc9c4] p-6">
        <h2 className="font-semibold text-[#00342b] mb-4">Merchants</h2>
        <ul className="flex flex-wrap gap-2">
          {(merchantRows ?? []).map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/merchant-operations/beneficiaries/${m.id}`}
                className="inline-block text-xs font-medium text-[#00342b] border border-[#bfc9c4] px-3 py-2 hover:border-[#00342b] transition-colors"
              >
                {m.business_name}
              </Link>
            </li>
          ))}
          {(merchantRows ?? []).length === 0 && <p className="text-sm text-[#707975]">No merchants yet.</p>}
        </ul>
      </div>
    </div>
  );
}
