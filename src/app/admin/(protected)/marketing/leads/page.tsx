import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateMarketingLeadForm from '@/components/admin/marketing/CreateMarketingLeadForm';
import QualificationToggle from '@/components/admin/marketing/QualificationToggle';
import { LEAD_SOURCES, labelFor } from '@/data/inquiries';

export const dynamic = 'force-dynamic';

interface LeadRow {
  id: string;
  full_name: string;
  business_name: string;
  lead_source: string | null;
  campaign_id: string | null;
  is_mql: boolean;
  is_sql: boolean;
  stage: string;
  created_at: string;
}

export default async function MarketingLeadsPage() {
  let canManage = true;
  try {
    await requirePermission('marketing_leads.view');
  } catch {
    return <AccessDenied requiredPermission="marketing_leads.view" />;
  }
  try {
    await requirePermission('leads.create');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data: leads, error }, { data: campaigns }] = await Promise.all([
    supabase
      .from('website_leads')
      .select('id, full_name, business_name, lead_source, campaign_id, is_mql, is_sql, stage, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('marketing_campaigns').select('id, name').order('name'),
  ]);

  const campaignNameById = new Map((campaigns ?? []).map((c) => [c.id, c.name]));
  const rows = (leads ?? []) as LeadRow[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Marketing Leads</h1>
          <p className="text-sm text-[#707975] mt-1">
            {rows.length} lead{rows.length === 1 ? '' : 's'} — the same CRM leads data (
            <Link href="/admin/inquiries" className="text-[#00342b] hover:underline">full CRM view →</Link>
            ), with source/campaign attribution and MQL/SQL qualification.
          </p>
        </div>
        {canManage && <CreateMarketingLeadForm campaigns={campaigns ?? []} />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load leads: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">MQL</th>
              <th className="px-4 py-3">SQL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr key={lead.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#00342b]">
                  <Link href={`/admin/inquiries/${lead.id}`} className="hover:underline">{lead.full_name}</Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{lead.business_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">{lead.lead_source ? labelFor(LEAD_SOURCES, lead.lead_source) : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{lead.campaign_id ? campaignNameById.get(lead.campaign_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945] capitalize">{lead.stage}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <QualificationToggle leadId={lead.id} field="is_mql" value={lead.is_mql} label={lead.is_mql ? 'MQL' : 'Mark MQL'} />
                  ) : (
                    lead.is_mql ? 'Yes' : '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <QualificationToggle leadId={lead.id} field="is_sql" value={lead.is_sql} label={lead.is_sql ? 'SQL' : 'Mark SQL'} />
                  ) : (
                    lead.is_sql ? 'Yes' : '—'
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">No leads yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
