'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  recordFinanceApproval,
  recordComplianceApproval,
  authorizeProductionActivation,
  deauthorizeProductionActivation,
} from '@/app/admin/(protected)/settings/integrations/selcom/production-readiness-actions';
import type { ProductionApprovalState } from '@/lib/selcom/production-readiness-items';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function ApprovalCard({
  title,
  approved,
  approvedBy,
  approvedAt,
  reason,
  canApprove,
  onSubmit,
}: {
  title: string;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  reason: string | null;
  canApprove: boolean;
  onSubmit: (approved: boolean, reason: string) => Promise<{ success: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [reasonDraft, setReasonDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(newApproved: boolean) {
    setPending(true);
    setError(null);
    const result = await onSubmit(newApproved, reasonDraft);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to record approval.');
      return;
    }
    setReasonDraft('');
    router.refresh();
  }

  return (
    <div className="bg-white border border-[#bfc9c4] p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold text-[#00342b] text-sm">{title}</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${approved ? 'bg-green-50 text-[#1b7a3d]' : 'bg-[#f5f3f3] text-[#707975]'}`}>
          {approved ? 'Approved' : 'Not Approved'}
        </span>
      </div>
      {approvedBy && (
        <p className="text-xs text-[#707975] mb-2">
          {approvedBy} · {formatDateTime(approvedAt)}
          {reason && <> — &quot;{reason}&quot;</>}
        </p>
      )}
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mb-2">{error}</p>}
      {canApprove && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              placeholder="Reason (required)"
              className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={pending || !reasonDraft.trim() || approved}
            onClick={() => handle(true)}
            className="text-xs font-medium text-white bg-[#1b7a3d] px-3 py-2 hover:bg-[#166030] transition-colors disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending || !reasonDraft.trim() || !approved}
            onClick={() => handle(false)}
            className="text-xs font-medium text-red-700 border border-red-700 px-3 py-2 hover:bg-red-700 hover:text-white transition-colors disabled:opacity-60"
          >
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}

// Finance approval, Compliance approval, and the final Super-Admin-only
// authorize/de-authorize action — "Finance and compliance approval
// recorded" modeled as two genuinely separate sign-offs. Authorizing here
// records a DB decision only; it never itself makes production live (see
// authorizeProductionActivation()'s own returned message and
// config.ts's header comment) — that additionally requires a separate
// Vercel deployment change.
export default function ProductionActivationPanel({
  approvals,
  checklistComplete,
  canApproveFinance,
  canApproveCompliance,
  canAuthorize,
}: {
  approvals: ProductionApprovalState;
  checklistComplete: boolean;
  canApproveFinance: boolean;
  canApproveCompliance: boolean;
  canAuthorize: boolean;
}) {
  const router = useRouter();
  const [authReason, setAuthReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canAuthorizeNow = checklistComplete && approvals.production_finance_approved && approvals.production_compliance_approved;

  async function handleAuthorize() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await authorizeProductionActivation(authReason);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to authorize production activation.');
      return;
    }
    setMessage(result.message ?? 'Authorized.');
    setAuthReason('');
    router.refresh();
  }

  async function handleDeauthorize() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await deauthorizeProductionActivation(authReason);
    setPending(false);
    if (!result.success) {
      setError(result.message ?? 'Failed to de-authorize production activation.');
      return;
    }
    setAuthReason('');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ApprovalCard
          title="Finance Approval"
          approved={approvals.production_finance_approved}
          approvedBy={approvals.production_finance_approved_by}
          approvedAt={approvals.production_finance_approved_at}
          reason={approvals.production_finance_approval_reason}
          canApprove={canApproveFinance}
          onSubmit={recordFinanceApproval}
        />
        <ApprovalCard
          title="Compliance Approval"
          approved={approvals.production_compliance_approved}
          approvedBy={approvals.production_compliance_approved_by}
          approvedAt={approvals.production_compliance_approved_at}
          reason={approvals.production_compliance_approval_reason}
          canApprove={canApproveCompliance}
          onSubmit={recordComplianceApproval}
        />
      </div>

      <div className="bg-white border border-[#bfc9c4] p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-[#00342b] text-sm">Production Activation Authorization</h3>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              approvals.production_activation_authorized ? 'bg-red-600 text-white' : 'bg-[#f5f3f3] text-[#707975]'
            }`}
          >
            {approvals.production_activation_authorized ? 'AUTHORIZED' : 'Not Authorized'}
          </span>
        </div>
        <p className="text-xs text-[#707975] mb-2">
          Requires every checklist item passed or not applicable, plus both Finance and Compliance approval. Recording
          this authorization does not itself make production live — a separate deployment change is still required.
        </p>
        {approvals.production_activation_authorized_by && (
          <p className="text-xs text-[#707975] mb-2">
            Authorized by {approvals.production_activation_authorized_by} · {formatDateTime(approvals.production_activation_authorized_at)}
            {approvals.production_activation_authorization_reason && <> — &quot;{approvals.production_activation_authorization_reason}&quot;</>}
          </p>
        )}
        {approvals.production_deauthorized_by && !approvals.production_activation_authorized && (
          <p className="text-xs text-[#8a5a00] mb-2">
            De-authorized by {approvals.production_deauthorized_by} · {formatDateTime(approvals.production_deauthorized_at)}
            {approvals.production_deauthorization_reason && <> — &quot;{approvals.production_deauthorization_reason}&quot;</>}
          </p>
        )}

        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 mb-2">{error}</p>}
        {message && <p className="text-xs text-[#1b7a3d] bg-green-50 border border-green-200 px-3 py-2 mb-2">{message}</p>}

        {canAuthorize && (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <input
                type="text"
                value={authReason}
                onChange={(e) => setAuthReason(e.target.value)}
                placeholder="Reason (required)"
                className="border border-[#bfc9c4] px-3 py-2 text-sm w-full focus:border-[#00342b] focus:outline-none"
              />
            </div>
            {!approvals.production_activation_authorized ? (
              <button
                type="button"
                disabled={pending || !authReason.trim() || !canAuthorizeNow}
                onClick={handleAuthorize}
                className="text-sm font-medium text-white bg-red-700 px-4 py-2 hover:bg-red-800 transition-colors disabled:opacity-60"
                title={!canAuthorizeNow ? 'Complete the checklist and both approvals first' : undefined}
              >
                Authorize Production Activation
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || !authReason.trim()}
                onClick={handleDeauthorize}
                className="text-sm font-medium text-[#8a1f1f] border border-[#8a1f1f] px-4 py-2 hover:bg-[#8a1f1f] hover:text-white transition-colors disabled:opacity-60"
              >
                De-authorize
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
