import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ExpenseApprovalQueueButtons from '@/components/admin/finance/ExpenseApprovalQueueButtons';
import { EXPENSE_CATEGORIES, labelFor, formatMoney, type Expense } from '@/data/finance';

export const dynamic = 'force-dynamic';

function Queue({ title, note, expenses, currency, stage }: { title: string; note: string; expenses: Expense[]; currency: string; stage: 'cfo' | 'ceo' }) {
  return (
    <div>
      <h2 className="font-semibold text-[#00342b] mb-1">{title}</h2>
      <p className="text-xs text-[#707975] mb-3">{note}</p>
      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">{expense.expense_number}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(EXPENSE_CATEGORIES, expense.category)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{expense.description}</td>
                <td className="px-4 py-3 tabular-nums text-[#3f4945]">{formatMoney(expense.amount, expense.currency ?? currency)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{expense.expense_date}</td>
                <td className="px-4 py-3">
                  <ExpenseApprovalQueueButtons id={expense.id} stage={stage} />
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#707975]">Nothing waiting here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ExpenseApprovalsPage() {
  let canCfoApprove = true;
  try {
    await requirePermission('expenses.approve');
  } catch {
    canCfoApprove = false;
  }
  let canCeoApprove = true;
  try {
    await requirePermission('expenses.ceo_approve');
  } catch {
    canCeoApprove = false;
  }

  if (!canCfoApprove && !canCeoApprove) {
    return <AccessDenied requiredPermission="expenses.approve" />;
  }

  const supabase = await createClient();
  const [{ data: expenses, error }, { data: settings }] = await Promise.all([
    supabase.from('expenses').select('*').in('status', ['submitted', 'pending_approval', 'pending_ceo_approval']).order('created_at', { ascending: true }),
    supabase.from('company_settings').select('default_currency, expense_high_value_threshold').eq('id', true).single(),
  ]);

  const currency = settings?.default_currency ?? 'TZS';
  const threshold = settings?.expense_high_value_threshold ?? 500000;
  const rows = (expenses ?? []) as Expense[];
  const cfoQueue = rows.filter((e) => e.status === 'submitted' || e.status === 'pending_approval');
  const ceoQueue = rows.filter((e) => e.status === 'pending_ceo_approval');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Expense Approvals</h1>
        <p className="text-sm text-[#707975] mt-1">
          Normal expenses need CFO approval. Expenses over {formatMoney(threshold, currency)} need CFO approval, then CEO approval.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load expenses: {error.message}
        </p>
      )}

      {canCfoApprove && (
        <Queue title="Awaiting CFO Approval" note="Approving a high-value expense here routes it to the CEO queue below instead of approving it outright." expenses={cfoQueue} currency={currency} stage="cfo" />
      )}
      {canCeoApprove && (
        <Queue title="Awaiting CEO Approval" note="High-value expenses already cleared by the CFO." expenses={ceoQueue} currency={currency} stage="ceo" />
      )}
    </div>
  );
}
