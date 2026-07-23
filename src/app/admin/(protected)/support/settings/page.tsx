import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import SlaRuleRow from '@/components/admin/support/SlaRuleRow';
import InlineSelect from '@/components/admin/InlineSelect';
import EscalationRuleRow from '@/components/admin/support/EscalationRuleRow';
import { labelFor, type SlaRule } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';
import { setTicketCategoryActiveOption } from './actions';

export const dynamic = 'force-dynamic';

const ACTIVE_OPTIONS = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] as const;

export default async function SupportSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('support.settings.view');
  } catch {
    return <AccessDenied requiredPermission="support.settings.view" />;
  }
  try {
    await requirePermission('support.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: rules }, { data: categories }, { data: escalationRules }, { data: settings }, { data: roleRows }] = await Promise.all([
    supabase.from('support_sla_rules').select('*').order('priority'),
    supabase.from('support_ticket_categories').select('*').order('name'),
    supabase.from('support_escalation_rules').select('*').order('priority'),
    supabase.from('company_settings').select('support_email').eq('id', true).single(),
    supabase.from('roles').select('id, name').eq('is_active', true).order('name'),
  ]);
  const rows = (rules ?? []) as SlaRule[];
  const roleOptions = (roleRows ?? []).map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Support Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          SLA rules, ticket categories, escalation rules, and the support inbox address. Support Email is edited from{' '}
          <a href="/admin/settings/company" className="underline hover:text-[#00342b]">Company Settings</a> — shown here for reference: <strong>{settings?.support_email ?? '—'}</strong>.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">SLA Rules</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Priority</th>
                <th className="py-2">Response Deadline</th>
                <th className="py-2">Resolution Deadline</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {canManage ? (
                rows.map((r) => <SlaRuleRow key={r.priority} priority={r.priority} initialResponseHours={r.response_hours} initialResolutionHours={r.resolution_hours} />)
              ) : (
                rows.map((r) => (
                  <tr key={r.priority} className="border-b border-[#e5e5e5] last:border-0">
                    <td className="py-2 text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, r.priority)}</td>
                    <td className="py-2 text-[#3f4945]">{r.response_hours}h</td>
                    <td className="py-2 text-[#3f4945]">{r.resolution_hours}h</td>
                    <td />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Ticket Categories</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Name</th>
                <th className="py-2">Description</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(categories ?? []).map((c) => (
                <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 text-[#1b1c1c] font-medium">{c.name}</td>
                  <td className="py-2 text-[#707975] text-xs">{c.description ?? '—'}</td>
                  <td className="py-2">
                    {canManage ? (
                      <InlineSelect value={String(c.is_active)} options={ACTIVE_OPTIONS} onSave={setTicketCategoryActiveOption.bind(null, c.id)} />
                    ) : (
                      <span className="text-xs text-[#3f4945]">{c.is_active ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-[#00342b] mb-2">Escalation Rules</h2>
        <div className="bg-white border border-[#bfc9c4] p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2">Priority</th>
                <th className="py-2">Escalate After</th>
                <th className="py-2">Escalate To</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(escalationRules ?? []).map((r) => (
                <EscalationRuleRow
                  key={r.priority}
                  priority={r.priority}
                  initialEscalateAfterHours={r.escalate_after_hours}
                  initialEscalateToRole={r.escalate_to_role}
                  roleOptions={roleOptions}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
