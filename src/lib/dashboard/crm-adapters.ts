import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { OPEN_OPPORTUNITY_STAGES } from '@/data/crm';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CrmOverview {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  salesQualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  leadConversionRatePct: number;
  activeOpportunities: number;
  opportunityValue: number;
  currency: string;
  newClients: number;
  followUpsDue: number;
  proposalsPending: number;
}

// "Sales-Qualified Leads" has no exact definition anywhere in the schema or
// request — no SQL/MQL distinction exists. Documented interpretation: leads
// that have progressed past initial qualification into active sales
// pursuit (needs_assessment or later in the pipeline).
const SALES_QUALIFIED_STAGES = ['needs_assessment', 'proposal_preparation', 'proposal_sent', 'negotiation'];

export async function getCrmOverview(supabase: Supabase, rangeFrom: Date): Promise<CrmOverview | null> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: leads, error: e1 },
    { data: opportunities, error: e2 },
    { data: clients, error: e3 },
    { data: followUps, error: e4 },
    { data: proposals, error: e5 },
    { data: settings },
  ] = await Promise.all([
    supabase.from('website_leads').select('stage, created_at'),
    supabase.from('opportunities').select('stage, estimated_value, currency'),
    supabase.from('clients').select('date_joined'),
    supabase.from('crm_follow_ups').select('follow_up_date, status'),
    supabase.from('proposals').select('status'),
    supabase.from('company_settings').select('default_currency').eq('id', true).single(),
  ]);

  if (e1 || e2 || e3 || e4 || e5 || !leads || !opportunities || !clients || !followUps || !proposals) return null;

  const currency = settings?.default_currency ?? opportunities[0]?.currency ?? 'TZS';

  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => new Date(l.created_at) >= rangeFrom).length;
  const qualifiedLeads = leads.filter((l) => l.stage === 'qualified').length;
  const salesQualifiedLeads = leads.filter((l) => SALES_QUALIFIED_STAGES.includes(l.stage)).length;
  const convertedLeads = leads.filter((l) => l.stage === 'won').length;
  const lostLeads = leads.filter((l) => l.stage === 'lost').length;
  const leadConversionRatePct = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;

  const openOpportunities = opportunities.filter((o) => OPEN_OPPORTUNITY_STAGES.includes(o.stage));
  const activeOpportunities = openOpportunities.length;
  const opportunityValue = openOpportunities.reduce((s, o) => s + (o.estimated_value ?? 0), 0);

  const newClients = clients.filter((c) => new Date(c.date_joined) >= rangeFrom).length;
  const followUpsDue = followUps.filter((f) => f.status === 'scheduled' && f.follow_up_date <= today).length;
  const proposalsPending = proposals.filter((p) => ['pending_approval', 'sent'].includes(p.status)).length;

  return {
    totalLeads,
    newLeads,
    qualifiedLeads,
    salesQualifiedLeads,
    convertedLeads,
    lostLeads,
    leadConversionRatePct,
    activeOpportunities,
    opportunityValue,
    currency,
    newClients,
    followUpsDue,
    proposalsPending,
  };
}
