import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import InlineSelect from '@/components/admin/InlineSelect';
import CreateTaxRecordForm from '@/components/admin/finance/CreateTaxRecordForm';
import { updateTaxRecordFilingStatusOption } from './actions';
import { TAX_CATEGORIES, TAX_FILING_STATUSES, labelFor, formatMoney, type TaxRecord } from '@/data/finance';

export const dynamic = 'force-dynamic';

export default async function TaxRecordsPage() {
  let canManage = true;
  try {
    await requirePermission('tax_records.view');
  } catch {
    return <AccessDenied requiredPermission="tax_records.view" />;
  }
  try {
    await requirePermission('tax_records.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data: settings } = await supabase.from('company_settings').select('default_currency').eq('id', true).single();
  const currency = settings?.default_currency ?? 'TZS';

  const { data: records, error } = await supabase.from('tax_records').select('*').order('tax_period', { ascending: false });
  const rows = (records ?? []) as TaxRecord[];
  const filingOptions = TAX_FILING_STATUSES.map((s) => ({ value: s.value, label: s.label }));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Tax Records</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} tax record{rows.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <CreateTaxRecordForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load tax records: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Taxable Amount</th>
              <th className="px-4 py-3">Tax Amount</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Filing Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{r.tax_period}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(TAX_CATEGORIES, r.tax_category)}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{formatMoney(r.taxable_amount, currency)}</td>
                <td className="px-4 py-3 text-[#3f4945] tabular-nums">{formatMoney(r.tax_amount, currency)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.reference ?? '—'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect value={r.filing_status} options={filingOptions} onSave={updateTaxRecordFilingStatusOption.bind(null, r.id)} />
                  ) : (
                    labelFor(TAX_FILING_STATUSES, r.filing_status)
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No tax records yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
