'use client';

import { useState } from 'react';

export interface SelcomIntegrationLogEntry {
  id: string;
  performed_by: string;
  action_type: string;
  result: 'success' | 'failure';
  reason: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  credential_configuration_change: 'Credential configuration change',
  environment_change: 'Environment change',
  connection_test: 'Sandbox connection test',
  balance_check: 'Balance check',
  balance_refresh: 'Disbursement balance refresh',
  callback_configuration_change: 'Callback configuration change',
  callback_configuration_check: 'Callback configuration check',
  callback_simulation: 'Callback simulation (sandbox test)',
  production_activation_requested: 'Production activation requested',
  integration_enabled: 'Integration enabled',
  integration_disabled: 'Integration disabled',
};

// Logs are pre-fetched server-side (page.tsx, gated by
// integrations.selcom.view) and passed in — this component only toggles
// visibility, no client-side fetch/round trip needed.
export default function SelcomIntegrationLogsPanel({ logs }: { logs: SelcomIntegrationLogEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
      >
        {open ? 'Hide Integration Logs' : 'View Integration Logs'}
      </button>

      {open && (
        <div className="mt-3 bg-white border border-[#bfc9c4] divide-y divide-[#efeded] max-h-[420px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#1b1c1c]">{ACTION_LABELS[log.action_type] ?? log.action_type}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${log.result === 'success' ? 'bg-green-50 text-[#1b7a3d]' : 'bg-red-50 text-red-700'}`}>
                  {log.result}
                </span>
              </div>
              <p className="text-xs text-[#707975] mt-0.5">
                {log.performed_by} · {new Date(log.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              {log.reason && <p className="text-xs text-[#3f4945] mt-1 italic">&quot;{log.reason}&quot;</p>}
            </div>
          ))}
          {logs.length === 0 && <p className="p-4 text-center text-sm text-[#707975]">No integration events recorded yet.</p>}
        </div>
      )}
    </div>
  );
}
