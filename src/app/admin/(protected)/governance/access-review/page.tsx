import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const PRIVILEGED_ACTIONS_LIMIT = 100;
// The categories that matter for a privileged-access review — mirrors
// RECORD_TYPE_BY_MODULE's buckets in src/lib/audit.ts, deliberately
// excluding 'crm'/'support'/'notifications'/'settings'/'operations' noise
// that the full Audit Logs page (/admin/audit-logs) already covers.
const PRIVILEGED_RECORD_TYPES = ['finance', 'compliance', 'governance', 'security', 'staff'];

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
}

interface AuditLogRow {
  id: string;
  performed_by: string;
  role: string | null;
  action_type: string;
  module: string;
  record_id: string | null;
  record_type: string;
  reason: string | null;
  result: 'success' | 'failure';
  created_at: string;
}

export default async function AccessReviewPage() {
  try {
    await requirePermission('access_reviews.view');
  } catch {
    return <AccessDenied requiredPermission="access_reviews.view" />;
  }

  const supabase = await createClient();
  const [{ data: staff, error: staffError }, { data: roles, error: rolesError }, { data: privilegedActions, error: actionsError }] =
    await Promise.all([
      supabase.from('staff_profiles').select('id, full_name, email, role, is_active').order('full_name'),
      supabase.from('roles').select('id, name, description').order('name'),
      supabase
        .from('audit_logs')
        .select('id, performed_by, role, action_type, module, record_id, record_type, reason, result, created_at')
        .in('record_type', PRIVILEGED_RECORD_TYPES)
        .order('created_at', { ascending: false })
        .limit(PRIVILEGED_ACTIONS_LIMIT),
    ]);

  const error = staffError ?? rolesError ?? actionsError;
  const staffList = (staff ?? []) as StaffRow[];
  const roleList = (roles ?? []) as RoleRow[];
  const actions = (privilegedActions ?? []) as AuditLogRow[];

  const staffByRole = new Map<string, StaffRow[]>();
  for (const member of staffList) {
    const list = staffByRole.get(member.role) ?? [];
    list.push(member);
    staffByRole.set(member.role, list);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Role & Privileged Access Review</h1>
        <p className="text-sm text-[#707975] mt-1">
          Who currently holds which role, and the most recent privileged actions across finance, compliance,
          governance, security and staff-management modules. Read-only — to change a role assignment, use{' '}
          <Link href="/admin/staff" className="underline hover:text-[#00342b]">Staff & Roles</Link>; to change what a
          role can do, use <Link href="/admin/governance/roles" className="underline hover:text-[#00342b]">Roles &amp; Permissions</Link>.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load access review data: {error.message}
        </p>
      )}

      <div className="mb-8">
        <h2 className="font-semibold text-[#00342b] mb-3">Role Assignments</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roleList.map((role) => {
            const members = staffByRole.get(role.id) ?? [];
            const activeMembers = members.filter((m) => m.is_active);
            return (
              <div key={role.id} className="bg-white border border-[#bfc9c4] p-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="font-semibold text-sm text-[#00342b]">{role.name}</h3>
                  <span className="text-xs text-[#707975]">{activeMembers.length} active</span>
                </div>
                {role.description && <p className="text-xs text-[#707975] mb-2">{role.description}</p>}
                {members.length === 0 ? (
                  <p className="text-xs text-[#a3a3a3]">No staff assigned.</p>
                ) : (
                  <ul className="space-y-1">
                    {members.map((member) => (
                      <li key={member.id} className="text-xs text-[#3f4945] flex items-center justify-between gap-2">
                        <span className="truncate" title={member.email}>{member.full_name}</span>
                        {!member.is_active && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#eeeeee] text-[#707975] shrink-0">
                            Inactive
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {roleList.length === 0 && !error && (
            <p className="text-sm text-[#707975]">No roles found.</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold text-[#00342b]">Recent Privileged Actions</h2>
          <Link href="/admin/audit-logs" className="text-xs font-medium text-[#00342b] hover:underline">
            Full Audit Logs →
          </Link>
        </div>
        <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 text-[#3f4945]">{action.performed_by}</td>
                  <td className="px-4 py-3 text-xs text-[#707975]">{action.role ?? '—'}</td>
                  <td className="px-4 py-3 text-[#1b1c1c] capitalize">{action.action_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{action.module.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs text-[#707975] font-mono max-w-[110px] truncate">{action.record_id ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#707975] max-w-[220px] truncate" title={action.reason ?? undefined}>{action.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${action.result === 'success' ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#fbdada] text-red-700'}`}>
                      {action.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                    {new Date(action.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
              {actions.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                    No privileged actions recorded yet.
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
