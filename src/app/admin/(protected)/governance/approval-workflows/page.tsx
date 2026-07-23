import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import InlineSelect from '@/components/admin/InlineSelect';
import WorkflowActiveToggle from '@/components/admin/governance/WorkflowActiveToggle';
import RaiseApprovalRequestForm from '@/components/admin/governance/RaiseApprovalRequestForm';
import ApprovalRequestActions from '@/components/admin/governance/ApprovalRequestActions';
import { APPROVAL_CATEGORIES, APPROVAL_REQUEST_STATUSES, labelFor, type ApprovalWorkflow, type ApprovalRequest } from '@/data/approvalWorkflows';
import { updateWorkflowApprover } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  approved: 'text-[#1b7a3d]',
  rejected: 'text-[#8a1f1f]',
};

export default async function ApprovalWorkflowsPage() {
  let canManage = true;
  try {
    await requirePermission('approval_workflows.view');
  } catch {
    return <AccessDenied requiredPermission="approval_workflows.view" />;
  }
  try {
    await requirePermission('approval_workflows.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [
    { data: workflows, error: workflowsError },
    { data: requests, error: requestsError },
    { data: roleRows },
  ] = await Promise.all([
    supabase.from('approval_workflows').select('*').order('category'),
    supabase.from('approval_requests').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('roles').select('id, name').eq('is_active', true).order('name'),
  ]);

  const workflowList = (workflows ?? []) as ApprovalWorkflow[];
  const requestList = (requests ?? []) as ApprovalRequest[];
  const roleOptions = (roleRows ?? []).map((r) => ({ value: r.id, label: r.name }));
  const workflowById = new Map(workflowList.map((w) => [w.id, w]));

  const error = workflowsError ?? requestsError;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Approval Workflows</h1>
        <p className="text-sm text-[#707975] mt-1">
          Who approves what, and the live queue of requests raised against each configured workflow.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load approval workflows: {error.message}
        </p>
      )}

      <div>
        <h2 className="font-semibold text-[#00342b] mb-3">Configured Workflows</h2>
        <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Approver Role</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {workflowList.map((w) => (
                <tr key={w.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                  <td className="px-4 py-3 font-medium text-[#00342b]">{labelFor(APPROVAL_CATEGORIES, w.category)}</td>
                  <td className="px-4 py-3 text-[#1b1c1c]">{w.name}</td>
                  <td className="px-4 py-3 text-xs text-[#707975] max-w-[240px] break-words">{w.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <InlineSelect value={w.approver_role ?? ''} options={roleOptions} onSave={updateWorkflowApprover.bind(null, w.id)} />
                    ) : (
                      <span className="text-[#3f4945]">{roleOptions.find((r) => r.value === w.approver_role)?.label ?? w.approver_role ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${w.is_active ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#eeeeee] text-[#3f4945]'}`}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <WorkflowActiveToggle id={w.id} isActive={w.is_active} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-semibold text-[#00342b]">Request Queue</h2>
            <p className="text-sm text-[#707975] mt-1">
              {requestList.length} request{requestList.length === 1 ? '' : 's'}. Deciding here records the decision —
              it does not itself change the underlying contract/invoice/expense record.
            </p>
          </div>
          <RaiseApprovalRequestForm workflows={workflowList} />
        </div>

        <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Decided By</th>
                {canManage && <th className="px-4 py-3">Decide</th>}
              </tr>
            </thead>
            <tbody>
              {requestList.map((r) => (
                <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                  <td className="px-4 py-3 font-medium text-[#1b1c1c]">{r.subject_label}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{labelFor(APPROVAL_CATEGORIES, r.category)}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.workflow_id ? workflowById.get(r.workflow_id)?.name ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.amount != null ? r.amount.toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{r.requested_by}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${STATUS_COLORS[r.status] ?? ''}`}>{labelFor(APPROVAL_REQUEST_STATUSES, r.status)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#707975]">{r.decided_by ?? '—'}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {r.status === 'pending' ? <ApprovalRequestActions id={r.id} /> : <span className="text-xs text-[#707975]">Decided</span>}
                    </td>
                  )}
                </tr>
              ))}
              {requestList.length === 0 && !error && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-4 py-10 text-center text-sm text-[#707975]">
                    No approval requests raised yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
