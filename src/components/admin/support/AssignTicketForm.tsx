'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignTicket } from '@/app/admin/(protected)/support-tickets/actions';
import StaffPicker, { type StaffOption } from '@/components/admin/crm/StaffPicker';

export default function AssignTicketForm({ ticketId, initialAssignedUserId, staff }: { ticketId: string; initialAssignedUserId: string; staff: StaffOption[] }) {
  const router = useRouter();
  const [assignedUserId, setAssignedUserId] = useState(initialAssignedUserId);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await assignTicket(ticketId, assignedUserId);
    setSaving(false);
    setFeedback(result.success ? 'Saved.' : result.message ?? 'Failed to assign.');
    if (result.success) router.refresh();
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="assignedUserId">Assigned Agent</label>
        <StaffPicker id="assignedUserId" value={assignedUserId} onChange={setAssignedUserId} staff={staff} />
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Assign'}
      </button>
      {feedback && <p className="text-xs text-[#707975]">{feedback}</p>}
    </div>
  );
}
