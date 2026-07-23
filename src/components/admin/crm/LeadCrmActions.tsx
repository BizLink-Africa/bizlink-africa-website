'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InlineSelect from '@/components/admin/InlineSelect';
import { assignLead, linkLeadCampaign, updateInquiry } from '@/app/admin/(protected)/actions';
import type { StaffOption } from './StaffPicker';

interface CampaignOption {
  id: string;
  name: string;
}

export default function LeadCrmActions({
  id,
  stage,
  assignedUserId,
  campaignId,
  staff,
  campaigns,
}: {
  id: string;
  stage: string;
  assignedUserId: string | null;
  campaignId: string | null;
  staff: StaffOption[];
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const staffOptions = [{ value: '', label: 'Unassigned' }, ...staff.map((s) => ({ value: s.id, label: s.full_name }))];
  const campaignOptions = [{ value: '', label: 'No campaign linked' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))];

  const runMark = async (target: 'won' | 'lost') => {
    const confirmMessage = target === 'won' ? 'Mark this lead as Won?' : 'Mark this lead as Lost?';
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    await updateInquiry(id, { stage: target });
    setPending(false);
    router.refresh();
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-5">
      <h2 className="font-semibold text-[#00342b]">Sales Actions</h2>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Assigned To</label>
        <InlineSelect value={assignedUserId ?? ''} options={staffOptions} onSave={(value) => assignLead(id, value || null)} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Linked Campaign</label>
        <InlineSelect value={campaignId ?? ''} options={campaignOptions} onSave={(value) => linkLeadCampaign(id, value || null)} />
      </div>

      {stage !== 'won' && stage !== 'lost' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => runMark('won')}
            className="text-sm font-medium px-4 py-2 border border-[#1b7a3d] text-[#1b7a3d] hover:bg-[#1b7a3d] hover:text-white transition-colors disabled:opacity-60"
          >
            Mark Won
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runMark('lost')}
            className="text-sm font-medium px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            Mark Lost
          </button>
        </div>
      )}
    </div>
  );
}
