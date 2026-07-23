import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import InlineSelect from '@/components/admin/InlineSelect';
import ComplianceSettingsForm from '@/components/admin/ComplianceSettingsForm';
import { setRequiredDocumentActiveOption } from './actions';

export const dynamic = 'force-dynamic';

const ACTIVE_OPTIONS = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] as const;
const RISK_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

interface RequiredDocument {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  is_active: boolean;
}

export default async function ComplianceSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('compliance.settings.view');
  } catch {
    return <AccessDenied requiredPermission="compliance.settings.view" />;
  }
  try {
    await requirePermission('compliance.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: settings }, { data: documents }] = await Promise.all([
    supabase.from('company_settings').select('compliance_review_frequency_days, compliance_policy_review_period_days').eq('id', true).single(),
    supabase.from('compliance_required_documents').select('*').order('name'),
  ]);

  const initial = {
    reviewFrequencyDays: settings?.compliance_review_frequency_days ?? 90,
    policyReviewPeriodDays: settings?.compliance_policy_review_period_days ?? 365,
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Compliance Settings</h1>
        <p className="text-sm text-[#707975] mt-1">Review cadence, risk levels, and required client/contract documents.</p>
      </div>

      {canManage ? (
        <ComplianceSettingsForm initial={initial} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Review Frequency:</span> {initial.reviewFrequencyDays} days</p>
          <p><span className="font-semibold text-[#707975]">Policy Review Period:</span> {initial.policyReviewPeriodDays} days</p>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Risk Levels</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <p className="text-xs text-[#707975] mb-3">
            Fixed levels used across Client Compliance, Contract Compliance, and Data Protection — not editable here.
          </p>
          <div className="flex gap-2 flex-wrap">
            {RISK_LEVELS.map((r) => (
              <span key={r.value} className="px-3 py-1.5 text-xs font-medium border border-[#bfc9c4] text-[#3f4945]">{r.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Required Documents</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Name</th>
                <th className="py-2">Description</th>
                <th className="py-2">Required</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {((documents ?? []) as RequiredDocument[]).map((doc) => (
                <tr key={doc.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 text-[#1b1c1c] font-medium">{doc.name}</td>
                  <td className="py-2 text-[#707975] text-xs">{doc.description ?? '—'}</td>
                  <td className="py-2 text-xs text-[#3f4945]">{doc.is_required ? 'Yes' : 'No'}</td>
                  <td className="py-2">
                    {canManage ? (
                      <InlineSelect value={String(doc.is_active)} options={ACTIVE_OPTIONS} onSave={setRequiredDocumentActiveOption.bind(null, doc.id)} />
                    ) : (
                      <span className="text-xs text-[#3f4945]">{doc.is_active ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
