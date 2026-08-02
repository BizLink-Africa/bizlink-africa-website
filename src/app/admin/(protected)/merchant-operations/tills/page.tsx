import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import RequestTillForm from '@/components/admin/merchant/RequestTillForm';
import TillRowActions from '@/components/admin/merchant/TillRowActions';
import { MERCHANT_TILL_STATUSES, MERCHANT_TILL_STATUS_COLORS, type MerchantTill } from '@/data/merchantOperations';
import { labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

export default async function MerchantTillsPage() {
  let canManage = true;
  try {
    await requirePermission('merchant_tills.view');
  } catch {
    return <AccessDenied requiredPermission="merchant_tills.view" />;
  }
  try {
    await requirePermission('merchant_tills.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: tills, error }, { data: merchantRows }] = await Promise.all([
    supabase.from('merchant_tills').select('*').order('requested_at', { ascending: false }),
    supabase.from('merchants').select('id, business_name').order('business_name'),
  ]);

  const merchantNameById = new Map((merchantRows ?? []).map((m) => [m.id, m.business_name]));
  const tillRows = (tills ?? []) as MerchantTill[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Merchant Tills</h1>
          <p className="text-sm text-[#707975] mt-1">{tillRows.length} result{tillRows.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <RequestTillForm merchants={merchantRows ?? []} />}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load merchant tills: {error.message}
        </p>
      )}

      <div className="mt-4 bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Partner Till Reference</th>
              <th className="px-4 py-3">Requested</th>
              {canManage && <th className="px-4 py-3">Update</th>}
            </tr>
          </thead>
          <tbody>
            {tillRows.map((t) => (
              <tr key={t.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3">
                  <Link href={`/admin/merchant-operations/profiles/${t.merchant_id}`} className="font-medium text-[#00342b] hover:underline">
                    {merchantNameById.get(t.merchant_id) ?? 'Unknown merchant'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${MERCHANT_TILL_STATUS_COLORS[t.status] ?? ''}`}>
                    {labelFor(MERCHANT_TILL_STATUSES, t.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{t.partner_till_reference ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{new Date(t.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <TillRowActions tillId={t.id} merchantId={t.merchant_id} status={t.status} partnerTillReference={t.partner_till_reference} />
                  </td>
                )}
              </tr>
            ))}
            {tillRows.length === 0 && !error && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No merchant tills requested yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
