export interface LeadCounts {
  total: number;
  new: number;
  contacted: number;
  in_discussion: number;
  proposal_sent: number;
  contract_review: number;
  offline_onboarding: number;
  active_client: number;
  rejected: number;
  dormant: number;
  failedNotifications: number;
}

const CARDS: Array<{ key: keyof LeadCounts; label: string; accent?: 'default' | 'danger' }> = [
  { key: 'total', label: 'Total Inquiries' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'in_discussion', label: 'In Discussion' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'contract_review', label: 'Contract Review' },
  { key: 'offline_onboarding', label: 'Offline Onboarding' },
  { key: 'active_client', label: 'Active Client' },
  { key: 'dormant', label: 'Dormant' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failedNotifications', label: 'Failed Notifications', accent: 'danger' },
];

export default function LeadsOverviewCards({ counts }: { counts: LeadCounts }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {CARDS.map(({ key, label, accent }) => (
        <div
          key={key}
          className={`bg-white border p-4 ${accent === 'danger' && counts[key] > 0 ? 'border-red-200' : 'border-[#bfc9c4]'}`}
        >
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider">{label}</p>
          <p className={`mt-1 font-bold text-2xl ${accent === 'danger' && counts[key] > 0 ? 'text-red-700' : 'text-[#00342b]'}`}>
            {counts[key]}
          </p>
        </div>
      ))}
    </div>
  );
}
