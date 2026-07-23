import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { CLIENT_COMPLIANCE_STATUSES, type ClientCompliance } from '@/data/clientCompliance';
import { RISK_LEVELS, labelFor } from '@/data/compliance';
import AddClientComplianceForm from '@/components/admin/compliance/AddClientComplianceForm';
import InlineSelect from '@/components/admin/InlineSelect';
import { updateClientComplianceStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[#707975]',
  compliant: 'text-[#1b7a3d]',
  non_compliant: 'text-[#8a1f1f]',
  under_review: 'text-[#8a5a00]',
};

const RISK_COLORS: Record<string, string> = {
  low: 'text-[#707975]',
  medium: 'text-[#8a5a00]',
  high: 'text-[#8a5a00]',
  critical: 'text-[#8a1f1f]',
};

interface ClientComplianceRow extends ClientCompliance {
  clients: { client_name: string; business_name: string } | null;
}

export default async function ClientCompliancePage() {
  let canManage = true;
  try {
    await requirePermission('client_compliance.view');
  } catch {
    return <AccessDenied requiredPermission="client_compliance.view" />;
  }
  try {
    await requirePermission('client_compliance.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: clients }, { data, error }] = await Promise.all([
    supabase.from('clients').select('id, client_name, business_name').order('client_name', { ascending: true }),
    supabase.from('client_compliance').select('*, clients(client_name, business_name)').order('created_at', { ascending: false }),
  ]);
  const records = (data ?? []) as unknown as ClientComplianceRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Client Compliance</h1>
          <p className="text-sm text-[#707975] mt-1">{records.length} record{records.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <AddClientComplianceForm clients={clients ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load client compliance records: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Compliance Status</th>
              <th className="px-4 py-3">Documents Received</th>
              <th className="px-4 py-3">Documents Pending</th>
              <th className="px-4 py-3">Review Date</th>
              <th className="px-4 py-3">Next Review</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{r.clients?.client_name ?? '—'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <InlineSelect
                      value={r.compliance_status}
                      options={CLIENT_COMPLIANCE_STATUSES}
                      onSave={updateClientComplianceStatus.bind(null, r.id)}
                      className={`border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none ${STATUS_COLORS[r.compliance_status] ?? ''}`}
                    />
                  ) : (
                    <span className={`text-xs font-medium ${STATUS_COLORS[r.compliance_status] ?? ''}`}>{labelFor(CLIENT_COMPLIANCE_STATUSES, r.compliance_status)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#3f4945]">{r.documents_received.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs text-[#8a5a00]">{r.documents_pending.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.review_date ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#707975]">{r.next_review_date ?? '—'}</td>
                <td className={`px-4 py-3 text-xs font-medium ${RISK_COLORS[r.risk_level] ?? ''}`}>{labelFor(RISK_LEVELS, r.risk_level)}</td>
                <td className="px-4 py-3 text-xs text-[#3f4945] max-w-[200px] break-words">{r.notes ?? '—'}</td>
              </tr>
            ))}
            {records.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No client compliance records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
