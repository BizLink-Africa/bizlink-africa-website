import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { getRecordActivity } from '@/lib/audit';
import { formatMoney } from '@/data/finance';
import type { Opportunity } from '@/data/crm';
import OpportunityStageBadge from '@/components/admin/crm/OpportunityStageBadge';
import OpportunityActionButtons from '@/components/admin/crm/OpportunityActionButtons';
import OpportunityDetailForm from '@/components/admin/crm/OpportunityDetailForm';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';

export const dynamic = 'force-dynamic';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let canManage = true;
  try {
    await requirePermission('opportunities.view');
  } catch {
    return <AccessDenied requiredPermission="opportunities.view" />;
  }
  try {
    await requirePermission('opportunities.manage');
  } catch {
    canManage = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: staffRows }, activity] = await Promise.all([
    supabase.from('opportunities').select('*, clients(business_name), website_leads(business_name)').eq('id', id).single(),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    getRecordActivity(supabase, 'opportunities', id),
  ]);

  if (error || !data) {
    notFound();
  }

  const opp = data as Opportunity & { clients: { business_name: string } | null; website_leads: { business_name: string } | null };
  const relatedName = opp.clients?.business_name ?? opp.website_leads?.business_name ?? '—';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm/opportunities" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Opportunities
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-bold text-2xl text-[#00342b]">{opp.name}</h1>
            <p className="text-sm text-[#707975] mt-1">{opp.opportunity_number} · {relatedName} · {formatMoney(opp.estimated_value, opp.currency)}</p>
          </div>
          <OpportunityStageBadge stage={opp.stage} />
        </div>
      </div>

      {canManage && (
        <div className="bg-white border border-[#bfc9c4] p-6">
          <h2 className="font-semibold text-[#00342b] mb-3">Stage Actions</h2>
          <OpportunityActionButtons id={opp.id} stage={opp.stage} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OpportunityDetailForm
          id={opp.id}
          initialEstimatedValue={opp.estimated_value}
          initialProbability={opp.probability}
          initialExpectedCloseDate={opp.expected_close_date ?? ''}
          initialOwnerUserId={opp.owner_user_id ?? ''}
          initialNextAction={opp.next_action ?? ''}
          initialCompetitorNotes={opp.competitor_notes ?? ''}
          staff={staffRows ?? []}
        />
        <ActivityTimeline entries={activity} />
      </div>
    </div>
  );
}
