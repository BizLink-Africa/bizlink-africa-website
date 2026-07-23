'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export interface FinanceSettingsInput {
  defaultCurrency: string;
  vatPercentage: number;
  invoicePrefix: string;
  proformaPrefix: string;
  defaultPaymentTermsDays: number;
  expenseHighValueThreshold: number;
  financialYearStartMonth: number;
}

export async function updateFinanceSettings(input: FinanceSettingsInput): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('finance.settings.manage');
  } catch {
    return { success: false, message: 'You do not have permission to change finance settings.' };
  }

  if (!input.defaultCurrency.trim() || !input.invoicePrefix.trim() || !input.proformaPrefix.trim()) {
    return { success: false, message: 'Currency and numbering prefixes are required.' };
  }
  if (input.vatPercentage < 0 || input.vatPercentage > 100) {
    return { success: false, message: 'VAT percentage must be between 0 and 100.' };
  }
  if (input.expenseHighValueThreshold < 0) {
    return { success: false, message: 'The CEO-approval threshold cannot be negative.' };
  }
  if (input.financialYearStartMonth < 1 || input.financialYearStartMonth > 12) {
    return { success: false, message: 'Financial year start month must be between 1 and 12.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_settings')
    .update({
      default_currency: input.defaultCurrency.trim().toUpperCase().slice(0, 3),
      vat_percentage: input.vatPercentage,
      invoice_prefix: input.invoicePrefix.trim().toUpperCase().slice(0, 10),
      proforma_prefix: input.proformaPrefix.trim().toUpperCase().slice(0, 10),
      default_payment_terms_days: input.defaultPaymentTermsDays,
      expense_high_value_threshold: input.expenseHighValueThreshold,
      financial_year_start_month: input.financialYearStartMonth,
    })
    .eq('id', true);

  if (error) {
    console.error('Failed to update finance settings', error);
    return { success: false, message: 'Failed to save finance settings.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'update',
    module: 'company_settings',
    newValue: input,
  });

  revalidatePath('/admin/finance/settings');
  revalidatePath('/admin/finance/expenses');
  return { success: true };
}
