import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import FinanceStatusBadge from '@/components/admin/finance/FinanceStatusBadge';
import CreateProformaForm from '@/components/admin/finance/CreateProformaForm';
import { PROFORMA_STATUSES, formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

export default async function ProformasPage() {
  let hasCreatePermission = true;
  try {
    await requirePermission('proformas.view');
  } catch {
    return <AccessDenied requiredPermission="proformas.view" />;
  }
  try {
    await requirePermission('proformas.create');
  } catch {
    hasCreatePermission = false;
  }

  const supabase = await createClient();
  const [{ data: proformas, error }, { data: settings }] = await Promise.all([
    supabase
      .from('proforma_invoices')
      .select('id, proforma_number, client_business_name, currency, total, status, valid_until, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('company_settings').select('default_currency, vat_percentage, default_payment_terms_days').eq('id', true).single(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Proforma Invoices</h1>
          <p className="text-sm text-[#707975] mt-1">{proformas?.length ?? 0} proforma{(proformas?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {hasCreatePermission && (
          <CreateProformaForm
            defaults={{
              currency: settings?.default_currency ?? 'TZS',
              taxPercentage: settings?.vat_percentage ?? 18,
              paymentTermsDays: settings?.default_payment_terms_days ?? 14,
            }}
          />
        )}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load proforma invoices: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Valid Until</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(proformas ?? []).map((p) => (
              <tr key={p.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  <Link href={`/admin/finance/proformas/${p.id}`} className="hover:underline">{p.proforma_number}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{p.client_business_name}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{formatMoney(p.total, p.currency)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{p.valid_until ?? '—'}</td>
                <td className="px-4 py-3"><FinanceStatusBadge status={p.status} list={PROFORMA_STATUSES} /></td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/finance/proformas/${p.id}`}
                    className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(proformas ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No proforma invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
