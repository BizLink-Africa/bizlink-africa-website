import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { ACCESS_REVIEW_DECISIONS, type AccessReview } from '@/data/accessReviews';
import AddAccessReviewForm from '@/components/admin/compliance/AddAccessReviewForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { recordAccessReviewDecision } from './actions';

export const dynamic = 'force-dynamic';

function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

const DECISION_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  approved: 'text-[#1b7a3d]',
  access_reduced_recommended: 'text-[#8a5a00]',
  revoke_recommended: 'text-[#8a1f1f]',
};

export default async function AccessReviewsPage() {
  let canManage = true;
  try {
    await requirePermission('access_reviews.view');
  } catch {
    return <AccessDenied requiredPermission="access_reviews.view" />;
  }
  try {
    await requirePermission('access_reviews.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: staff }, { data, error }] = await Promise.all([
    supabase.from('staff_profiles').select('id, full_name, email, role').eq('is_active', true).order('full_name'),
    supabase.from('access_reviews').select('*').order('created_at', { ascending: false }),
  ]);
  const reviews = (data ?? []) as AccessReview[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Access Reviews</h1>
          <p className="text-sm text-[#707975] mt-1">
            {reviews.length} review{reviews.length === 1 ? '' : 's'} — recommendations only; role/permission changes still require Staff &amp; Roles.
          </p>
        </div>
        {canManage && <AddAccessReviewForm staff={staff ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load access reviews: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1300px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3">Reviewer</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">Excessive Access</th>
              <th className="px-4 py-3">Decision</th>
              <th className="px-4 py-3">Review Date</th>
              <th className="px-4 py-3">Next Review</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3] align-top">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{r.user_label}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.role_label ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.department ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[200px] break-words">{r.permissions_summary ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{r.reviewer ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[200px] break-words">{r.findings ?? '—'}</td>
                <td className="px-4 py-3">
                  {r.excessive_access_flag ? (
                    <span className="text-xs font-medium text-[#8a1f1f]">Flagged</span>
                  ) : (
                    <span className="text-xs text-[#707975]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect
                      value={r.decision}
                      options={ACCESS_REVIEW_DECISIONS}
                      onSave={recordAccessReviewDecision.bind(null, r.id)}
                      className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${DECISION_COLORS[r.decision] ?? ''}`}
                    />
                  ) : (
                    <span className={`text-xs font-medium ${DECISION_COLORS[r.decision] ?? ''}`}>{labelFor(ACCESS_REVIEW_DECISIONS, r.decision)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.review_date}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.next_review_date ?? '—'}</td>
              </tr>
            ))}
            {reviews.length === 0 && !error && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No access reviews recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
