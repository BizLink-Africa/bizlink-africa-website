import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import FinanceStatusBadge from '@/components/admin/finance/FinanceStatusBadge';
import CreateExpenseForm from '@/components/admin/finance/CreateExpenseForm';
import { EXPENSE_STATUSES, EXPENSE_CATEGORIES, labelFor, formatMoney } from '@/data/finance';

export const dynamic = 'force-dynamic';

const PENDING_APPROVAL_STATUSES = new Set(['submitted', 'pending_approval', 'pending_ceo_approval']);

export default async function ExpensesPage() {
  let canApprove = true;
  try {
    await requirePermission('expenses.view');
  } catch {
    return <AccessDenied requiredPermission="expenses.view" />;
  }
  try {
    await requirePermission('expenses.approve');
  } catch {
    canApprove = false;
  }

  const supabase = await createClient();
  const [{ data: expenses, error }, { data: settings }] = await Promise.all([
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('company_settings').select('default_currency, expense_high_value_threshold').eq('id', true).single(),
  ]);

  const threshold = settings?.expense_high_value_threshold ?? 500000;
  const pendingApprovalCount = (expenses ?? []).filter((e) => PENDING_APPROVAL_STATUSES.has(e.status)).length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Expenses</h1>
          <p className="text-sm text-[#707975] mt-1">
            {expenses?.length ?? 0} expense{(expenses?.length ?? 0) === 1 ? '' : 's'}. Expenses over{' '}
            {formatMoney(threshold, settings?.default_currency ?? 'TZS')} require CFO and CEO approval.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canApprove && pendingApprovalCount > 0 && (
            <Link
              href="/admin/finance/expense-approvals"
              className="text-sm font-medium text-[#8a5a00] border border-[#eadfb0] bg-[#fef3e0] px-4 py-2 hover:bg-[#fbe8c6] transition-colors"
            >
              {pendingApprovalCount} pending your approval →
            </Link>
          )}
          <CreateExpenseForm currency={settings?.default_currency ?? 'TZS'} />
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load expenses: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(expenses ?? []).map((expense) => {
              const highValue = expense.amount > threshold;
              return (
                <tr key={expense.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#00342b]">{expense.expense_number}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{labelFor(EXPENSE_CATEGORIES, expense.category)}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{expense.description}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={highValue ? 'text-[#8a1f1f] font-medium' : 'text-[#3f4945]'}>
                      {formatMoney(expense.amount, expense.currency)}
                    </span>
                    {highValue && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a1f1f]">High Value</span>}
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{expense.expense_date}</td>
                  <td className="px-4 py-3"><FinanceStatusBadge status={expense.status} list={EXPENSE_STATUSES} /></td>
                </tr>
              );
            })}
            {(expenses ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No expenses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
