import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { JOB_STATUSES, type BackgroundJob } from '@/data/backgroundJobs';
import { labelFor } from '@/data/inquiries';
import AddBackgroundJobForm from '@/components/admin/AddBackgroundJobForm';
import RetryJobButton from '@/components/admin/RetryJobButton';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  queued: 'text-[#707975]',
  running: 'text-[#8a5a00]',
  completed: 'text-[#1b7a3d]',
  failed: 'text-[#8a1f1f]',
  retrying: 'text-[#8a5a00]',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function BackgroundJobsPage() {
  let canManage = true;
  try {
    await requirePermission('jobs.view');
  } catch {
    return <AccessDenied requiredPermission="jobs.view" />;
  }
  try {
    await requirePermission('jobs.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('background_jobs').select('*').order('created_at', { ascending: false }).limit(200);
  const jobs = (data ?? []) as BackgroundJob[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Background Jobs</h1>
          <p className="text-sm text-[#707975] mt-1">Most recent 200 jobs across every queue.</p>
        </div>
        {canManage && <AddBackgroundJobForm />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load background jobs: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Job Name</th>
              <th className="px-4 py-3">Queue</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Retries</th>
              <th className="px-4 py-3">Failure Reason</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{job.job_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{job.queue}</td>
                <td className={`px-4 py-3 text-xs font-medium ${STATUS_COLORS[job.status] ?? ''}`}>{labelFor(JOB_STATUSES, job.status)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(job.started_at)}</td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">{formatDateTime(job.completed_at)}</td>
                <td className="px-4 py-3 text-[#3f4945]">{job.retries}</td>
                <td className="px-4 py-3 text-xs text-red-700 max-w-[220px] break-words">{job.failure_reason ?? '—'}</td>
                <td className="px-4 py-3">
                  {canManage && job.status === 'failed' && <RetryJobButton id={job.id} />}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No background jobs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
