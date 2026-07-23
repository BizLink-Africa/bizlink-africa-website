import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRecordActivity } from '@/lib/audit';
import { REQUESTED_SOLUTIONS, PREFERRED_CONTACT_METHODS, LEAD_STAGES, LEAD_SOURCES, labelFor, type Inquiry } from '@/data/inquiries';
import type { OnboardingChecklist as OnboardingChecklistRow } from '@/data/clients';
import StatusBadge from '@/components/admin/StatusBadge';
import NotificationBadge from '@/components/admin/NotificationBadge';
import InquiryDetailForm from '@/components/admin/InquiryDetailForm';
import QuickActions from '@/components/admin/QuickActions';
import ConvertToClientButton from '@/components/admin/ConvertToClientButton';
import OnboardingChecklist from '@/components/admin/OnboardingChecklist';
import LeadCrmActions from '@/components/admin/crm/LeadCrmActions';
import ActivityTimeline from '@/components/admin/crm/ActivityTimeline';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data, error }, { data: linkedClient }, { data: checklist }, { data: staffRows }, { data: campaignRows }, activity] = await Promise.all([
    supabase.from('website_leads').select('*').eq('id', id).single(),
    supabase.from('clients').select('id').eq('lead_id', id).maybeSingle(),
    supabase.from('onboarding_checklists').select('*').eq('lead_id', id).maybeSingle(),
    supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('marketing_campaigns').select('id, name').order('name'),
    getRecordActivity(supabase, 'website_leads', id),
  ]);

  if (error || !data) {
    notFound();
  }

  const inquiry = data as Inquiry;
  const checklistRow = checklist as OnboardingChecklistRow | null;

  const fields: Array<[string, string]> = [
    ['Lead Number', inquiry.lead_number ?? '—'],
    ['Inquiry ID', inquiry.id],
    ['Business Name', inquiry.business_name],
    ['Email', inquiry.email],
    ['Phone / WhatsApp', inquiry.phone],
    ['Business Type / Service Offered', inquiry.business_type],
    ['Location', inquiry.location],
    ['Preferred Contact Method', inquiry.preferred_contact_method ? labelFor(PREFERRED_CONTACT_METHODS, inquiry.preferred_contact_method) : '—'],
    ['Consent Given', inquiry.consent_given ? 'Yes' : 'No'],
    ['Lead Score', String(inquiry.lead_score)],
    ['Lead Source', inquiry.lead_source ? labelFor(LEAD_SOURCES, inquiry.lead_source) : '—'],
    ['Created', formatDateTime(inquiry.created_at)],
    ['Updated', formatDateTime(inquiry.updated_at)],
  ];

  return (
    <div>
      <Link href="/admin/inquiries" className="text-sm text-[#707975] hover:text-[#00342b]">← Back to Inquiries</Link>

      <div className="mt-4 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">{inquiry.full_name}</h1>
          <p className="text-sm text-[#707975] mt-1">
            Submitted {new Date(inquiry.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={inquiry.status} />
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#e0f2ee] text-[#00342b]">
            {labelFor(LEAD_STAGES, inquiry.stage)}
          </span>
          <NotificationBadge status={inquiry.notification_status} />
          <Link
            href={`/admin/crm/opportunities/new?leadId=${inquiry.id}`}
            className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
          >
            Create Opportunity
          </Link>
          <Link
            href={`/admin/crm/proposals/new?leadId=${inquiry.id}`}
            className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
          >
            Link Proposal
          </Link>
          {linkedClient ? (
            <Link
              href={`/admin/clients/${linkedClient.id}`}
              className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-2 hover:bg-[#00342b] hover:text-white transition-colors"
            >
              View Client
            </Link>
          ) : (
            <ConvertToClientButton leadId={inquiry.id} />
          )}
        </div>
      </div>

      {inquiry.notification_status === 'failed' && inquiry.notification_error && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Notification email failed: {inquiry.notification_error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-5">
          <h2 className="font-semibold text-[#00342b]">Inquiry Details</h2>
          <table className="w-full text-sm">
            <tbody>
              {fields.map(([label, value]) => (
                <tr key={label} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 pr-4 text-[#707975] align-top w-56">{label}</td>
                  <td className="py-2 break-all">{value}</td>
                </tr>
              ))}
              <tr className="border-b border-[#e5e5e5]">
                <td className="py-2 pr-4 text-[#707975] align-top">Requested Solution</td>
                <td className="py-2">
                  {inquiry.requested_solution.map((s) => labelFor(REQUESTED_SOLUTIONS, s)).join(', ') || '—'}
                </td>
              </tr>
            </tbody>
          </table>
          <div>
            <p className="text-xs text-[#707975] uppercase tracking-wider font-semibold mb-1">Message</p>
            <p className="text-sm whitespace-pre-wrap">{inquiry.message || 'No additional message provided.'}</p>
          </div>
        </div>

        <div className="space-y-6">
          <InquiryDetailForm
            id={inquiry.id}
            initialStatus={inquiry.status}
            initialAdminNotes={inquiry.admin_notes ?? ''}
            initialPriority={inquiry.priority}
            initialFollowUpDate={inquiry.follow_up_date ?? ''}
            initialStage={inquiry.stage}
            initialLeadScore={inquiry.lead_score}
            initialLeadSource={inquiry.lead_source ?? ''}
          />

          <LeadCrmActions
            id={inquiry.id}
            stage={inquiry.stage}
            assignedUserId={inquiry.assigned_user_id}
            campaignId={inquiry.campaign_id}
            staff={staffRows ?? []}
            campaigns={campaignRows ?? []}
          />

          <QuickActions
            id={inquiry.id}
            email={inquiry.email}
            phone={inquiry.phone}
            businessName={inquiry.business_name}
            lastContactedAt={inquiry.last_contacted_at}
          />

          <OnboardingChecklist owner={{ leadId: inquiry.id }} initialValues={checklistRow ?? {}} />

          <ActivityTimeline entries={activity} />
        </div>
      </div>
    </div>
  );
}
