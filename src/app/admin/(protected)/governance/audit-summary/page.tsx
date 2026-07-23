import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

function formatWhen(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

interface AuditRow {
  id: string;
  performed_by: string;
  action_type: string;
  record_id: string | null;
  created_at: string;
}

function SummarySection({
  title,
  description,
  count,
  rows,
}: {
  title: string;
  description: string;
  count: number;
  rows: { id: string; primary: string; secondary: string; when: string }[];
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="font-semibold text-[#00342b]">{title} <span className="text-sm font-normal text-[#707975]">({count})</span></h2>
        <p className="text-xs text-[#707975] mt-0.5">{description}</p>
      </div>
      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-2.5 text-[#1b1c1c]">{r.primary}</td>
                <td className="px-4 py-2.5 text-[#3f4945]">{r.secondary}</td>
                <td className="px-4 py-2.5 text-xs text-[#707975] whitespace-nowrap text-right">{r.when}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-xs text-[#707975]">No entries recorded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function GovernanceAuditSummaryPage() {
  try {
    await requirePermission('governance.audit.view');
  } catch {
    return <AccessDenied requiredPermission="governance.audit.view" />;
  }

  const supabase = await createClient();
  const [
    { data: roleChanges },
    { data: permissionChanges },
    { data: highRiskApprovals },
    { data: failedLogins },
    { data: sensitiveExports },
  ] = await Promise.all([
    supabase.from('audit_logs').select('id, performed_by, action_type, record_id, created_at').eq('module', 'roles').order('created_at', { ascending: false }).limit(25),
    supabase.from('audit_logs').select('id, performed_by, action_type, record_id, created_at').eq('module', 'role_permissions').order('created_at', { ascending: false }).limit(25),
    supabase.from('approval_requests').select('id, subject_label, status, decided_by, decided_at').eq('category', 'high_risk_operations').not('decided_at', 'is', null).order('decided_at', { ascending: false }).limit(25),
    supabase.from('login_events').select('id, email, ip_address, failure_reason, occurred_at').eq('success', false).order('occurred_at', { ascending: false }).limit(25),
    supabase.from('audit_logs').select('id, performed_by, action_type, record_id, created_at').eq('action_type', 'export').order('created_at', { ascending: false }).limit(25),
  ]);

  const roleChangeRows = (roleChanges ?? []) as AuditRow[];
  const permissionChangeRows = (permissionChanges ?? []) as AuditRow[];
  const exportRows = (sensitiveExports ?? []) as AuditRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Audit Summary</h1>
        <p className="text-sm text-[#707975] mt-1">
          Read-only. For the full unfiltered log, see{' '}
          <a href="/admin/audit-logs" className="underline hover:text-[#00342b]">Audit Logs</a>.
        </p>
      </div>

      <SummarySection
        title="Role Changes"
        description="Roles created, renamed, cloned, activated, or deactivated."
        count={roleChangeRows.length}
        rows={roleChangeRows.map((r) => ({ id: r.id, primary: r.action_type.replace(/_/g, ' '), secondary: r.performed_by, when: formatWhen(r.created_at) }))}
      />

      <SummarySection
        title="Permission Changes"
        description="Permissions granted to or revoked from a role via the Roles & Permissions matrix."
        count={permissionChangeRows.length}
        rows={permissionChangeRows.map((r) => ({ id: r.id, primary: r.action_type.replace(/_/g, ' '), secondary: `${r.performed_by} — ${r.record_id ?? ''}`, when: formatWhen(r.created_at) }))}
      />

      <SummarySection
        title="High-Risk Approvals"
        description="Decided requests routed through the High-Risk Operations approval workflow."
        count={(highRiskApprovals ?? []).length}
        rows={(highRiskApprovals ?? []).map((r) => ({ id: r.id, primary: r.subject_label, secondary: `${r.status} by ${r.decided_by ?? '—'}`, when: r.decided_at ? formatWhen(r.decided_at) : '—' }))}
      />

      <SummarySection
        title="Failed Access Attempts"
        description={'Failed logins from Login Monitoring. Requires the logins.view permission — shows empty if your role doesn’t hold it.'}
        count={(failedLogins ?? []).length}
        rows={(failedLogins ?? []).map((r) => ({ id: r.id, primary: r.email, secondary: `${r.failure_reason ?? 'Unknown reason'}${r.ip_address ? ` — ${r.ip_address}` : ''}`, when: formatWhen(r.occurred_at) }))}
      />

      <SummarySection
        title="Sensitive Exports"
        description="CSV exports taken from Reports & Analytics and Governance Reports."
        count={exportRows.length}
        rows={exportRows.map((r) => ({ id: r.id, primary: r.record_id ?? r.action_type, secondary: r.performed_by, when: formatWhen(r.created_at) }))}
      />
    </div>
  );
}
