import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { BACKUP_TYPES, BACKUP_STATUSES, type BackupRecord } from '@/data/backups';
import { labelFor } from '@/data/inquiries';
import AddBackupRecordForm from '@/components/admin/AddBackupRecordForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { updateBackupStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-[#707975]',
  running: 'text-[#8a5a00]',
  completed: 'text-[#1b7a3d]',
  failed: 'text-[#8a1f1f]',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function BackupMonitoringPage() {
  let canManage = true;
  try {
    await requirePermission('backups.view');
  } catch {
    return <AccessDenied requiredPermission="backups.view" />;
  }
  try {
    await requirePermission('backups.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('backup_records').select('*').order('created_at', { ascending: false }).limit(200);
  const backups = (data ?? []) as BackupRecord[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Backup Monitoring</h1>
          <p className="text-sm text-[#707975] mt-1">Most recent 200 backup runs across every system.</p>
        </div>
        {canManage && <AddBackupRecordForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load backup records: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">System</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Next Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{b.system}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(BACKUP_TYPES, b.backup_type)}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect
                      value={b.status}
                      options={BACKUP_STATUSES}
                      onSave={updateBackupStatus.bind(null, b.id)}
                      className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[b.status] ?? ''}`}
                    />
                  ) : (
                    <span className={`text-xs font-medium ${STATUS_COLORS[b.status] ?? ''}`}>{labelFor(BACKUP_STATUSES, b.status)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(b.started_at)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(b.completed_at)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{b.size_mb != null ? `${b.size_mb} MB` : '—'}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{b.location ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(b.next_scheduled_at)}</td>
              </tr>
            ))}
            {backups.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No backups recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
