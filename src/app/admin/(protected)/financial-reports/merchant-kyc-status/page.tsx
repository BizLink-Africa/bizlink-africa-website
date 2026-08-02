import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

interface SearchParams { status?: string }

export default async function MerchantKycStatusReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('financial_reports.view');
  } catch {
    return <AccessDenied requiredPermission="financial_reports.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('merchants').select('id, business_name, status, onboarding_status, risk_status').order('business_name');
  if (params.status) query = query.eq('onboarding_status', params.status);
  const { data: merchants, error } = await query;

  const { data: kycRows } = await supabase.from('merchant_kyc_reviews').select('merchant_id, partner_decision, recorded_at').order('recorded_at', { ascending: false });
  const latestKycByMerchant = new Map<string, { partner_decision: string; recorded_at: string }>();
  for (const k of kycRows ?? []) {
    if (!latestKycByMerchant.has(k.merchant_id)) latestKycByMerchant.set(k.merchant_id, k);
  }

  const exportUrl = `/admin/financial-reports/merchant-kyc-status/export?${new URLSearchParams(params as Record<string, string>).toString()}`;

  return (
    <div>
      <Link href="/admin/financial-reports" className="text-xs font-medium text-[#00342b] hover:underline">← All Reports</Link>
      <h1 className="font-bold text-2xl text-[#00342b] mt-3 mb-6">Merchant KYC Status</h1>

      <form className="mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Onboarding Status</label>
          <select name="status" defaultValue={params.status ?? ''} className="border border-[#bfc9c4] px-3 py-2 text-sm min-w-[220px] focus:border-[#00342b] focus:outline-none">
            <option value="">All</option>
            {['application_received', 'pre_screening', 'documents_incomplete', 'submitted_to_partner', 'kyc_under_review', 'additional_information_required', 'kyc_approved', 'till_created', 'settlement_setup_pending', 'active', 'rejected', 'suspended'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors">Filter</button>
        <a href={exportUrl} className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors">Export CSV</a>
      </form>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error.message}</p>}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Merchant</th><th className="px-4 py-3">Onboarding Status</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Latest Partner KYC Decision</th>
            </tr>
          </thead>
          <tbody>
            {(merchants ?? []).map((m) => {
              const kyc = latestKycByMerchant.get(m.id);
              return (
                <tr key={m.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 text-[#1b1c1c] font-medium">{m.business_name}</td>
                  <td className="px-4 py-3 text-xs text-[#3f4945] capitalize">{m.onboarding_status.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs text-[#3f4945] capitalize">{m.risk_status}</td>
                  <td className="px-4 py-3 text-xs text-[#3f4945] capitalize">{kyc?.partner_decision?.replace(/_/g, ' ') ?? 'Not yet submitted'}</td>
                </tr>
              );
            })}
            {(merchants ?? []).length === 0 && !error && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[#707975]">No merchants for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
