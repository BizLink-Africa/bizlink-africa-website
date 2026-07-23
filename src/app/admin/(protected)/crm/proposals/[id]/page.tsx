import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { getRecordActivity } from '@/lib/audit';
import { formatMoney } from '@/data/finance';
import { SERVICE_CATALOG } from '@/data/services';
import { labelFor as labelForService, type Proposal, type ProposalVersion } from '@/data/crm';
import ProposalStatusBadge from '@/components/admin/crm/ProposalStatusBadge';
import ProposalActionButtons from '@/components/admin/crm/ProposalActionButtons';
import UploadProposalVersionForm from '@/components/admin/crm/UploadProposalVersionForm';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';

export const dynamic = 'force-dynamic';

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let canManage = true;
  try {
    await requirePermission('proposals.view');
  } catch {
    return <AccessDenied requiredPermission="proposals.view" />;
  }
  try {
    await requirePermission('proposals.manage');
  } catch {
    canManage = false;
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: versions }, activity] = await Promise.all([
    supabase.from('proposals').select('*, clients(business_name), website_leads(business_name)').eq('id', id).single(),
    supabase.from('proposal_versions').select('*').eq('proposal_id', id).order('version_number', { ascending: false }),
    getRecordActivity(supabase, 'proposals', id),
  ]);

  if (error || !data) {
    notFound();
  }

  const proposal = data as Proposal & { clients: { business_name: string } | null; website_leads: { business_name: string } | null };
  const relatedName = proposal.clients?.business_name ?? proposal.website_leads?.business_name ?? '—';

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm/proposals" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Proposals
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-bold text-2xl text-[#00342b]">{proposal.proposal_number}</h1>
            <p className="text-sm text-[#707975] mt-1">{relatedName} · {formatMoney(proposal.pricing_summary_total, proposal.currency)}</p>
          </div>
          <ProposalStatusBadge status={proposal.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
            <h2 className="font-semibold text-[#00342b]">Proposal Details</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[#e5e5e5]">
                  <td className="py-2 pr-4 text-[#707975] w-40">Services</td>
                  <td className="py-2">{proposal.services.map((s) => labelForService(SERVICE_CATALOG, s)).join(', ') || '—'}</td>
                </tr>
                <tr className="border-b border-[#e5e5e5]">
                  <td className="py-2 pr-4 text-[#707975]">Scope</td>
                  <td className="py-2 whitespace-pre-wrap">{proposal.scope ?? '—'}</td>
                </tr>
                <tr className="border-b border-[#e5e5e5]">
                  <td className="py-2 pr-4 text-[#707975]">Pricing Notes</td>
                  <td className="py-2">{proposal.pricing_notes ?? '—'}</td>
                </tr>
                <tr className="border-b border-[#e5e5e5]">
                  <td className="py-2 pr-4 text-[#707975]">Valid Until</td>
                  <td className="py-2">{proposal.valid_until ?? '—'}</td>
                </tr>
                <tr className="border-b border-[#e5e5e5]">
                  <td className="py-2 pr-4 text-[#707975]">Sent Date</td>
                  <td className="py-2">{proposal.sent_date ?? '—'}</td>
                </tr>
                <tr className="border-b border-[#e5e5e5]">
                  <td className="py-2 pr-4 text-[#707975]">Client Response</td>
                  <td className="py-2">{proposal.client_response ?? '—'}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-[#707975]">Approved By</td>
                  <td className="py-2">{proposal.approved_by ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {canManage && (
            <div className="bg-white border border-[#bfc9c4] p-6">
              <h2 className="font-semibold text-[#00342b] mb-3">Status Actions</h2>
              <ProposalActionButtons id={proposal.id} status={proposal.status} />
            </div>
          )}

          <div className="bg-white border border-[#bfc9c4] p-6 space-y-3">
            <h2 className="font-semibold text-[#00342b]">Version History</h2>
            {canManage && <UploadProposalVersionForm proposalId={proposal.id} />}
            {versions && versions.length > 0 ? (
              <ul className="divide-y divide-[#e5e5e5] mt-3">
                {(versions as ProposalVersion[]).map((v) => (
                  <li key={v.id} className="py-2 text-sm flex items-center justify-between">
                    <span>v{v.version_number} — {v.file_name}</span>
                    <span className="text-xs text-[#707975]">{v.uploaded_by}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#707975] mt-3">No versions uploaded yet.</p>
            )}
          </div>
        </div>

        <ActivityTimeline entries={activity} />
      </div>
    </div>
  );
}
