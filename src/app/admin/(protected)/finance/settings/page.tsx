import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import FinanceSettingsForm from '@/components/admin/finance/FinanceSettingsForm';

export const dynamic = 'force-dynamic';

interface FinanceSettingsRow {
  default_currency: string;
  vat_percentage: number;
  invoice_prefix: string;
  proforma_prefix: string;
  default_payment_terms_days: number;
  expense_high_value_threshold: number;
  financial_year_start_month: number;
}

export default async function FinanceSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('finance.settings.view');
  } catch {
    return <AccessDenied requiredPermission="finance.settings.view" />;
  }
  try {
    await requirePermission('finance.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('company_settings')
    .select('default_currency, vat_percentage, invoice_prefix, proforma_prefix, default_payment_terms_days, expense_high_value_threshold, financial_year_start_month')
    .eq('id', true)
    .single();

  const settings = (data ?? {
    default_currency: 'TZS',
    vat_percentage: 18,
    invoice_prefix: 'INV',
    proforma_prefix: 'PRO',
    default_payment_terms_days: 14,
    expense_high_value_threshold: 500000,
    financial_year_start_month: 1,
  }) as FinanceSettingsRow;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Finance Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          Currency, VAT rate, document numbering, and the expense approval threshold used across every Finance page.
        </p>
      </div>

      {canManage ? (
        <FinanceSettingsForm
          initial={{
            defaultCurrency: settings.default_currency,
            vatPercentage: settings.vat_percentage,
            invoicePrefix: settings.invoice_prefix,
            proformaPrefix: settings.proforma_prefix,
            defaultPaymentTermsDays: settings.default_payment_terms_days,
            expenseHighValueThreshold: settings.expense_high_value_threshold,
            financialYearStartMonth: settings.financial_year_start_month,
          }}
        />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Default Currency:</span> {settings.default_currency}</p>
          <p><span className="font-semibold text-[#707975]">VAT Percentage:</span> {settings.vat_percentage}%</p>
          <p><span className="font-semibold text-[#707975]">Invoice Prefix:</span> {settings.invoice_prefix}</p>
          <p><span className="font-semibold text-[#707975]">Proforma Prefix:</span> {settings.proforma_prefix}</p>
          <p><span className="font-semibold text-[#707975]">Default Payment Terms:</span> {settings.default_payment_terms_days} days</p>
          <p><span className="font-semibold text-[#707975]">Expense CEO-Approval Threshold:</span> {settings.expense_high_value_threshold}</p>
          <p><span className="font-semibold text-[#707975]">Financial Year Starts:</span> Month {settings.financial_year_start_month}</p>
        </div>
      )}
    </div>
  );
}
