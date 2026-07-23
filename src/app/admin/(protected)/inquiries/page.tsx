import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import { INQUIRY_STATUSES, REQUESTED_SOLUTIONS, NOTIFICATION_STATUS_OPTIONS, labelFor, type Inquiry } from '@/data/inquiries';
import InquiryFilters from '@/components/admin/InquiryFilters';
import StatusBadge from '@/components/admin/StatusBadge';
import NotificationBadge from '@/components/admin/NotificationBadge';
import LeadsOverviewCards, { type LeadCounts } from '@/components/admin/LeadsOverviewCards';
import AddLeadForm from '@/components/admin/crm/AddLeadForm';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  status?: string;
  solution?: string;
  notification?: string;
  from?: string;
  to?: string;
}

function buildCounts(rows: Array<Pick<Inquiry, 'status' | 'notification_status'>>): LeadCounts {
  const counts: LeadCounts = {
    total: rows.length,
    new: 0,
    contacted: 0,
    in_discussion: 0,
    proposal_sent: 0,
    contract_review: 0,
    offline_onboarding: 0,
    active_client: 0,
    rejected: 0,
    dormant: 0,
    failedNotifications: 0,
  };

  for (const row of rows) {
    if (row.status in counts) {
      (counts as unknown as Record<string, number>)[row.status] += 1;
    }
    if (row.notification_status === 'failed') {
      counts.failedNotifications += 1;
    }
  }

  return counts;
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  let canCreate = true;
  try {
    await requirePermission('leads.view');
  } catch {
    return <AccessDenied requiredPermission="leads.view" />;
  }
  try {
    await requirePermission('leads.create');
  } catch {
    canCreate = false;
  }

  const params = await searchParams;
  const supabase = await createClient();

  const { data: staffRows } = await supabase.from('staff_profiles').select('id, full_name').eq('is_active', true).order('full_name');

  // Overview cards reflect totals across every inquiry, independent of the
  // filters applied to the table below.
  const { data: allRows } = await supabase.from('website_leads').select('status, notification_status');
  const counts = buildCounts((allRows ?? []) as Array<Pick<Inquiry, 'status' | 'notification_status'>>);

  let query = supabase
    .from('website_leads')
    .select(
      'id, full_name, business_name, email, phone, location, requested_solution, status, notification_status, notification_error, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (params.q) {
    const term = params.q.trim();
    query = query.or(
      `full_name.ilike.%${term}%,business_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,location.ilike.%${term}%`
    );
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.solution) {
    query = query.contains('requested_solution', [params.solution]);
  }
  if (params.notification) {
    query = query.eq('notification_status', params.notification);
  }
  if (params.from) {
    query = query.gte('created_at', new Date(params.from).toISOString());
  }
  if (params.to) {
    const to = new Date(params.to);
    to.setDate(to.getDate() + 1);
    query = query.lt('created_at', to.toISOString());
  }

  const { data, error } = await query;
  const inquiries = (data ?? []) as Pick<
    Inquiry,
    | 'id'
    | 'full_name'
    | 'business_name'
    | 'email'
    | 'phone'
    | 'location'
    | 'requested_solution'
    | 'status'
    | 'notification_status'
    | 'notification_error'
    | 'created_at'
    | 'updated_at'
  >[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Leads / Inquiries</h1>
          <p className="text-sm text-[#707975] mt-1">{inquiries.length} result{inquiries.length === 1 ? '' : 's'}</p>
        </div>
        {canCreate && <AddLeadForm staff={staffRows ?? []} />}
      </div>

      <LeadsOverviewCards counts={counts} />

      <InquiryFilters statuses={INQUIRY_STATUSES} solutions={REQUESTED_SOLUTIONS} notificationStatuses={NOTIFICATION_STATUS_OPTIONS} />

      {error && (
        <p className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load inquiries: {error.message}
        </p>
      )}

      <div className="mt-6 bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Requested Solution</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notified</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inquiry) => (
              <tr key={inquiry.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3">
                  <Link href={`/admin/inquiries/${inquiry.id}`} className="font-medium text-[#00342b] hover:underline">
                    {inquiry.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{inquiry.business_name}</td>
                <td className="px-4 py-3 text-[#3f4945]">
                  <div>{inquiry.email}</div>
                  <div className="text-xs text-[#707975]">{inquiry.phone}</div>
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{inquiry.location}</td>
                <td className="px-4 py-3 text-[#3f4945]">
                  {inquiry.requested_solution.map((s) => labelFor(REQUESTED_SOLUTIONS, s)).join(', ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inquiry.status} />
                </td>
                <td className="px-4 py-3">
                  <NotificationBadge
                    status={inquiry.notification_status}
                    title={inquiry.notification_status === 'failed' ? (inquiry.notification_error ?? undefined) : undefined}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                  {new Date(inquiry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-xs text-[#707975] whitespace-nowrap">
                  {new Date(inquiry.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/inquiries/${inquiry.id}`}
                    className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {inquiries.length === 0 && !error && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No inquiries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
