import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

interface PayoutIntegrationStatusRow {
  id: string;
  transaction_reference: string;
  merchant_name: string;
  integration_status: string | null;
  api_response_status: string | null;
  payment_partner_status: string | null;
  checked_at: string;
  technical_error: string | null;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

// Technical-only visibility into payment-integration transaction status, for
// integration troubleshooting. Deliberately does not show amounts,
// beneficiary details, or any payout approval/action controls — the
// settlement/payout module itself is an archived, Super-Admin-only
// financial prototype (see src/lib/archived-financial-prototype.ts).
// BizLink Africa does not receive, hold, reconcile, disburse or settle
// merchant funds; this page exists only to help diagnose integration
// failures against the approved payment partner.
export default async function PayoutIntegrationStatusPage() {
  try {
    await requirePermission('integrations.view');
  } catch {
    return <AccessDenied requiredPermission="integrations.view" />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_payout_integration_status')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as PayoutIntegrationStatusRow[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Integration Status</h1>
        <p className="text-sm text-[#707975] mt-1">
          Technical status of payment-integration transactions, for troubleshooting only — no amounts, no payout
          actions. Settlement and payouts are handled directly by the approved payment partner.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load transaction status: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Transaction Reference</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Integration Status</th>
              <th className="px-4 py-3">API Response Status</th>
              <th className="px-4 py-3">Payment-Partner Status</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Technical Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#1b1c1c] font-medium whitespace-nowrap">{row.transaction_reference}</td>
                <td className="px-4 py-3 text-[#3f4945]">{row.merchant_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{row.integration_status ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{row.api_response_status ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{row.payment_partner_status ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(row.checked_at)}</td>
                <td className="px-4 py-3 text-xs text-red-700 max-w-[240px] break-words">{row.technical_error ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No transaction status records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
