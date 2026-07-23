import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SystemSettingsForm from '@/components/admin/SystemSettingsForm';
import type { SystemSettingsInput } from './actions';

export const dynamic = 'force-dynamic';

interface SystemSettingsRow {
  system_timezone: string;
  system_language: string;
  system_file_storage_notes: string | null;
  default_currency: string;
  maintenance_mode: boolean;
}

export default async function SystemSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('system.settings.view');
  } catch {
    return <AccessDenied requiredPermission="system.settings.view" />;
  }
  try {
    await requirePermission('system.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('company_settings')
    .select('system_timezone, system_language, system_file_storage_notes, default_currency, maintenance_mode')
    .eq('id', true)
    .single();

  const settings = data as SystemSettingsRow | null;
  const initial: SystemSettingsInput = {
    timezone: settings?.system_timezone ?? 'Africa/Dar_es_Salaam',
    language: settings?.system_language ?? 'en',
    fileStorageNotes: settings?.system_file_storage_notes ?? '',
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'Not configured';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">System Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          Locale, storage notes, and read-only references into the settings and monitoring pages that own the
          underlying values.
        </p>
      </div>

      {canManage ? (
        <SystemSettingsForm initial={initial} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Timezone:</span> {initial.timezone}</p>
          <p><span className="font-semibold text-[#707975]">Language:</span> {initial.language}</p>
          <p><span className="font-semibold text-[#707975]">File Storage Notes:</span> {initial.fileStorageNotes || '—'}</p>
        </div>
      )}

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
        <h2 className="font-semibold text-[#00342b] mb-1">References</h2>
        <p>
          <span className="font-semibold text-[#707975]">Currency:</span> {settings?.default_currency ?? '—'} — edited on{' '}
          <Link href="/admin/finance/settings" className="underline hover:text-[#00342b]">Finance Settings</Link>
        </p>
        <p>
          <span className="font-semibold text-[#707975]">Maintenance Mode:</span> {settings?.maintenance_mode ? 'On' : 'Off'} — edited on{' '}
          <Link href="/admin/technology/settings" className="underline hover:text-[#00342b]">Technology Settings</Link>
        </p>
        <p>
          <span className="font-semibold text-[#707975]">Backups:</span> tracked on{' '}
          <Link href="/admin/backup-monitoring" className="underline hover:text-[#00342b]">Backup Monitoring</Link>
        </p>
        <p>
          <span className="font-semibold text-[#707975]">System Status:</span> live on{' '}
          <Link href="/admin/system-health" className="underline hover:text-[#00342b]">System Health</Link>
        </p>
      </div>

      <div className="bg-white border border-[#bfc9c4] p-6 space-y-2">
        <h2 className="font-semibold text-[#00342b] mb-1">Environment</h2>
        <p className="text-xs text-[#707975]">Project URL only — API keys and secrets are never shown here.</p>
        <p className="text-sm text-[#3f4945] font-mono break-all">{supabaseUrl}</p>
      </div>
    </div>
  );
}
