import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

const FETCH_LIMIT = 500;

interface AuditLog {
  id: string;
  performed_by: string;
  action_type: string;
  module: string;
  record_id: string | null;
  record_type: string;
  result: 'success' | 'failure';
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

interface SearchParams {
  user?: string;
  role?: string;
  module?: string;
  action?: string;
  recordType?: string;
  result?: string;
  dateFrom?: string;
  dateTo?: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return JSON.stringify(value);
}

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('audit.view');
  } catch {
    return <AccessDenied requiredPermission="audit.view" />;
  }

  const params = await searchParams;
  const supabase = await createClient();

  // Read-only: a single recent-window fetch (append-only table, no
  // create/update/delete UI anywhere on this page), then every filter —
  // including Role, which has no column on audit_logs itself and is derived
  // from the performer's CURRENT staff_profiles.role — is applied in
  // memory. See the migration comment on audit_logs.result/record_type for
  // why Role is intentionally current-role, not a point-in-time snapshot.
  const [{ data, error }, { data: staffRows }] = await Promise.all([
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(FETCH_LIMIT),
    supabase.from('staff_profiles').select('email, role'),
  ]);

  const allLogs = (data ?? []) as AuditLog[];
  const roleByEmail = new Map((staffRows ?? []).map((s) => [s.email.toLowerCase(), s.role as string]));

  const modules = [...new Set(allLogs.map((l) => l.module))].sort();
  const actions = [...new Set(allLogs.map((l) => l.action_type))].sort();
  const recordTypes = [...new Set(allLogs.map((l) => l.record_type))].sort();
  const roles = [...new Set(Array.from(roleByEmail.values()))].sort();

  const dateFromTime = params.dateFrom ? new Date(params.dateFrom).getTime() : null;
  const dateToTime = params.dateTo ? new Date(`${params.dateTo}T23:59:59.999`).getTime() : null;

  const logs = allLogs.filter((log) => {
    if (params.user && !log.performed_by.toLowerCase().includes(params.user.toLowerCase())) return false;
    if (params.role && roleByEmail.get(log.performed_by.toLowerCase()) !== params.role) return false;
    if (params.module && log.module !== params.module) return false;
    if (params.action && log.action_type !== params.action) return false;
    if (params.recordType && log.record_type !== params.recordType) return false;
    if (params.result && log.result !== params.result) return false;
    const created = new Date(log.created_at).getTime();
    if (dateFromTime !== null && created < dateFromTime) return false;
    if (dateToTime !== null && created > dateToTime) return false;
    return true;
  });

  const hasFilters = Object.values(params).some(Boolean);
  const selectClass = 'border border-[#bfc9c4] px-2 py-2 text-xs focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Audit Logs</h1>
        <p className="text-sm text-[#707975] mt-1">
          Read-only — {logs.length} of the {allLogs.length} most recent entries match these filters. Every mutation
          and every denied access attempt in this app writes here; nothing on this page can edit or delete a row.
        </p>
      </div>

      <form method="GET" className="mb-4 bg-white border border-[#bfc9c4] p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
        <div>
          <label className={labelClass} htmlFor="user">User</label>
          <input id="user" name="user" defaultValue={params.user ?? ''} placeholder="Email contains..." className="w-full border border-[#bfc9c4] px-2 py-2 text-xs focus:border-[#00342b] focus:outline-none" />
        </div>
        <div>
          <label className={labelClass} htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue={params.role ?? ''} className={selectClass}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="module">Module</label>
          <select id="module" name="module" defaultValue={params.module ?? ''} className={selectClass}>
            <option value="">All modules</option>
            {modules.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="action">Action</label>
          <select id="action" name="action" defaultValue={params.action ?? ''} className={selectClass}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="recordType">Record type</label>
          <select id="recordType" name="recordType" defaultValue={params.recordType ?? ''} className={selectClass}>
            <option value="">All record types</option>
            {recordTypes.map((rt) => <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="result">Result</label>
          <select id="result" name="result" defaultValue={params.result ?? ''} className={selectClass}>
            <option value="">All results</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <div>
            <label className={labelClass} htmlFor="dateFrom">From</label>
            <input id="dateFrom" name="dateFrom" type="date" defaultValue={params.dateFrom ?? ''} className="border border-[#bfc9c4] px-2 py-2 text-xs focus:border-[#00342b] focus:outline-none" />
          </div>
          <div>
            <label className={labelClass} htmlFor="dateTo">To</label>
            <input id="dateTo" name="dateTo" type="date" defaultValue={params.dateTo ?? ''} className="border border-[#bfc9c4] px-2 py-2 text-xs focus:border-[#00342b] focus:outline-none" />
          </div>
        </div>
        <div className="col-span-2 sm:col-span-4 lg:col-span-7 flex gap-2">
          <button type="submit" className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
            Apply Filters
          </button>
          {hasFilters && (
            <Link href="/admin/audit-logs" className="text-sm text-[#707975] hover:text-[#00342b] px-2 py-2">
              Clear
            </Link>
          )}
        </div>
      </form>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load audit logs: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Record Type</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">New Value</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#3f4945]">{log.performed_by}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{roleByEmail.get(log.performed_by.toLowerCase()) ?? '—'}</td>
                <td className="px-4 py-3 text-[#1b1c1c] capitalize">{log.action_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-[#3f4945]">{log.module.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs text-[#707975] font-mono max-w-[110px] truncate">{log.record_id ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] capitalize">{log.record_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${log.result === 'success' ? 'bg-[#dcf5e3] text-[#1b7a3d]' : 'bg-[#fbdada] text-red-700'}`}>
                    {log.result}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#707975] max-w-[220px] break-words">{formatValue(log.new_value)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No audit log entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
