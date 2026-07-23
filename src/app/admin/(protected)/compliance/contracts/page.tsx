import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { CONTRACT_REVIEW_STATUSES, CONTRACT_APPROVAL_STATUSES, type ContractCompliance } from '@/data/contractCompliance';
import { labelFor } from '@/data/compliance';
import AddContractComplianceForm from '@/components/admin/compliance/AddContractComplianceForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { updateContractReviewStatus, updateContractApprovalStatus } from './actions';

export const dynamic = 'force-dynamic';

const REVIEW_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  in_review: 'text-[#8a5a00]',
  reviewed: 'text-[#1b7a3d]',
  flagged: 'text-[#8a1f1f]',
};

const APPROVAL_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  approved: 'text-[#1b7a3d]',
  rejected: 'text-[#8a1f1f]',
};

interface ContractComplianceRow extends ContractCompliance {
  contracts: { contract_number: string; contract_title: string } | null;
}

export default async function ContractCompliancePage() {
  let canManage = true;
  try {
    await requirePermission('contract_compliance.view');
  } catch {
    return <AccessDenied requiredPermission="contract_compliance.view" />;
  }
  try {
    await requirePermission('contract_compliance.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: contracts }, { data, error }] = await Promise.all([
    supabase.from('contracts').select('id, contract_number, contract_title').order('contract_number', { ascending: false }),
    supabase.from('contract_compliance').select('*, contracts(contract_number, contract_title)').order('created_at', { ascending: false }),
  ]);
  const records = (data ?? []) as unknown as ContractComplianceRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Contract Compliance</h1>
          <p className="text-sm text-[#707975] mt-1">{records.length} record{records.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <AddContractComplianceForm contracts={contracts ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load contract compliance records: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Contract</th>
              <th className="px-4 py-3">Required Clauses</th>
              <th className="px-4 py-3">Review Status</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Reviewer</th>
              <th className="px-4 py-3">Review Date</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{r.contracts?.contract_number ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{r.required_clauses.join(', ') || '—'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect
                      value={r.review_status}
                      options={CONTRACT_REVIEW_STATUSES}
                      onSave={updateContractReviewStatus.bind(null, r.id)}
                      className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${REVIEW_COLORS[r.review_status] ?? ''}`}
                    />
                  ) : (
                    <span className={`text-xs font-medium ${REVIEW_COLORS[r.review_status] ?? ''}`}>{labelFor(CONTRACT_REVIEW_STATUSES, r.review_status)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[200px] break-words">{r.findings ?? '—'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect
                      value={r.approval_status}
                      options={CONTRACT_APPROVAL_STATUSES}
                      onSave={updateContractApprovalStatus.bind(null, r.id)}
                      className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${APPROVAL_COLORS[r.approval_status] ?? ''}`}
                    />
                  ) : (
                    <span className={`text-xs font-medium ${APPROVAL_COLORS[r.approval_status] ?? ''}`}>{labelFor(CONTRACT_APPROVAL_STATUSES, r.approval_status)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{r.reviewer ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.review_date ?? '—'}</td>
              </tr>
            ))}
            {records.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No contract compliance records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
