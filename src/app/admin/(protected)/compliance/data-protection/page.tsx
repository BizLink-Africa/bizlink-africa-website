import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { RISK_LEVELS, labelFor } from '@/data/compliance';
import type { DataProtectionActivity } from '@/data/dataProtection';
import AddDataProtectionActivityForm from '@/components/admin/compliance/AddDataProtectionActivityForm';

export const dynamic = 'force-dynamic';

const RISK_COLORS: Record<string, string> = {
  low: 'text-[#707975]',
  medium: 'text-[#8a5a00]',
  high: 'text-[#8a5a00]',
  critical: 'text-[#8a1f1f]',
};

export default async function DataProtectionPage() {
  let canManage = true;
  try {
    await requirePermission('data_protection.view');
  } catch {
    return <AccessDenied requiredPermission="data_protection.view" />;
  }
  try {
    await requirePermission('data_protection.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('data_protection_activities').select('*').order('created_at', { ascending: false });
  const activities = (data ?? []) as DataProtectionActivity[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Data Protection</h1>
          <p className="text-sm text-[#707975] mt-1">Record of processing activities (RoPA) — {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}.</p>
        </div>
        {canManage && <AddDataProtectionActivityForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load data protection activities: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1300px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Processing Activity</th>
              <th className="px-4 py-3">Data Category</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Legal Basis</th>
              <th className="px-4 py-3">Retention</th>
              <th className="px-4 py-3">Access Roles</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Review Date</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{a.processing_activity}</td>
                <td className="px-4 py-3 text-[#3f4945]">{a.data_category}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[180px] break-words">{a.purpose ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{a.legal_basis ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{a.retention_period ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{a.access_roles.join(', ') || '—'}</td>
                <td className={`px-4 py-3 text-xs font-medium ${RISK_COLORS[a.risk_level] ?? ''}`}>{labelFor(RISK_LEVELS, a.risk_level)}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{a.review_date ?? '—'}</td>
              </tr>
            ))}
            {activities.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No data protection activities recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
