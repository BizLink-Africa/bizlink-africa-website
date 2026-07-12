import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface AuditLog {
  id: string;
  performed_by: string;
  action_type: string;
  module: string;
  record_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return JSON.stringify(value);
}

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const { module } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (module) query = query.eq('module', module);

  const { data, error } = await query;
  const logs = (data ?? []) as AuditLog[];

  const modules = ['support_tickets', 'integration_health', 'ai_agent_configs', 'staff_profiles', 'company_settings'];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b]">Audit Logs</h1>
          <p className="text-sm text-[#707975] mt-1">
            {logs.length} recent entr{logs.length === 1 ? 'y' : 'ies'}. Covers Support Tickets, Integration Health, AI
            Agents, Staff & Roles, and Settings — Leads and Clients actions aren&apos;t instrumented yet.
          </p>
        </div>
        <div className="flex gap-1 bg-white border border-[#bfc9c4] p-1 flex-wrap">
          <Link
            href="/admin/audit-logs"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${!module ? 'bg-[#00342b] text-white' : 'text-[#3f4945] hover:bg-[#f5f3f3]'}`}
          >
            All
          </Link>
          {modules.map((m) => (
            <Link
              key={m}
              href={`/admin/audit-logs?module=${m}`}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${module === m ? 'bg-[#00342b] text-white' : 'text-[#3f4945] hover:bg-[#f5f3f3]'}`}
            >
              {m.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load audit logs: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Old Value</th>
              <th className="px-4 py-3">New Value</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 text-[#3f4945]">{log.performed_by}</td>
                <td className="px-4 py-3 text-[#1b1c1c] capitalize">{log.action_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-[#3f4945]">{log.module.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs text-[#707975] font-mono max-w-[120px] truncate">{log.record_id ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] max-w-[200px] break-words">{formatValue(log.old_value)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] max-w-[200px] break-words">{formatValue(log.new_value)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No audit log entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
