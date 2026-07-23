import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateOpportunityForm from '@/components/admin/crm/CreateOpportunityForm';

export const dynamic = 'force-dynamic';

export default async function NewOpportunityPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  try {
    await requirePermission('opportunities.manage');
  } catch {
    return <AccessDenied requiredPermission="opportunities.manage" />;
  }

  const { leadId } = await searchParams;
  const supabase = await createClient();

  const [{ data: staffRows }, { data: clientRows }, { data: settings }, { data: lead }] = await Promise.all([
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('clients').select('id, business_name').order('business_name'),
    supabase.from('company_settings').select('default_currency').eq('id', true).single(),
    leadId ? supabase.from('website_leads').select('business_name').eq('id', leadId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm/opportunities" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Opportunities
        </Link>
        <h1 className="font-bold text-2xl text-[#00342b]">New Opportunity</h1>
      </div>

      <CreateOpportunityForm
        staff={staffRows ?? []}
        clients={clientRows ?? []}
        leadId={leadId}
        defaultName={lead?.business_name ? `${lead.business_name} Opportunity` : undefined}
        defaultCurrency={settings?.default_currency ?? 'TZS'}
      />
    </div>
  );
}
