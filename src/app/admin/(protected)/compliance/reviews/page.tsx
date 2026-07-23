import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ComplianceStatusBadge from '@/components/admin/compliance/ComplianceStatusBadge';
import CreateComplianceReviewForm from '@/components/admin/compliance/CreateComplianceReviewForm';
import ComplianceReviewActions from '@/components/admin/compliance/ComplianceReviewActions';
import { COMPLIANCE_STATUSES, COMPLIANCE_CATEGORIES, RISK_LEVELS, labelFor, type ComplianceReview } from '@/data/compliance';

export const dynamic = 'force-dynamic';

const RISK_COLORS: Record<string, string> = {
  low: 'text-[#707975]',
  medium: 'text-[#8a5a00]',
  high: 'text-[#8a5a00]',
  critical: 'text-[#8a1f1f]',
};

interface ReviewRow extends ComplianceReview {
  clients: { client_name: string } | null;
}

export default async function ComplianceReviewsPage() {
  let hasManagePermission = true;
  try {
    await requirePermission('compliance.view');
  } catch {
    return <AccessDenied requiredPermission="compliance.view" />;
  }
  try {
    await requirePermission('compliance.manage');
  } catch {
    hasManagePermission = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('compliance_reviews')
    .select('*, clients(client_name)')
    .order('created_at', { ascending: false });
  const reviews = (data ?? []) as unknown as ReviewRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Compliance Reviews</h1>
          <p className="text-sm text-[#707975] mt-1">{reviews.length} review{reviews.length === 1 ? '' : 's'}</p>
        </div>
        {hasManagePermission && <CreateComplianceReviewForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load compliance reviews: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1300px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Review #</th>
              <th className="px-4 py-3">Client / Department</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Completed</th>
              {hasManagePermission && <th className="px-4 py-3">Action</th>}
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                <td className="px-4 py-3 font-mono text-xs text-[#3f4945]">{r.review_number ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.clients?.client_name ?? r.department ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(COMPLIANCE_CATEGORIES, r.category)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.reviewer ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.start_date ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.due_date ?? '—'}</td>
                <td className={`px-4 py-3 text-xs font-medium ${r.risk_level ? RISK_COLORS[r.risk_level] : ''}`}>{r.risk_level ? labelFor(RISK_LEVELS, r.risk_level) : '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[220px] break-words">{r.findings ?? '—'}</td>
                <td className="px-4 py-3"><ComplianceStatusBadge status={r.status} list={COMPLIANCE_STATUSES} /></td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.completed_date ?? '—'}</td>
                {hasManagePermission && (
                  <td className="px-4 py-3">
                    <ComplianceReviewActions id={r.id} status={r.status} riskLevel={r.risk_level} />
                  </td>
                )}
              </tr>
            ))}
            {reviews.length === 0 && !error && (
              <tr>
                <td colSpan={hasManagePermission ? 11 : 10} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No compliance reviews yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
