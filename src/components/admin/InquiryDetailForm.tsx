'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INQUIRY_STATUSES, PRIORITY_LEVELS, LEAD_STAGES, LEAD_SOURCES } from '@/data/inquiries';
import { updateInquiry } from '@/app/admin/(protected)/actions';

export default function InquiryDetailForm({
  id,
  initialStatus,
  initialAdminNotes,
  initialPriority,
  initialFollowUpDate,
  initialStage,
  initialLeadScore,
  initialLeadSource,
}: {
  id: string;
  initialStatus: string;
  initialAdminNotes: string;
  initialPriority: string;
  initialFollowUpDate: string;
  initialStage: string;
  initialLeadScore: number;
  initialLeadSource: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [adminNotes, setAdminNotes] = useState(initialAdminNotes);
  const [priority, setPriority] = useState(initialPriority);
  const [followUpDate, setFollowUpDate] = useState(initialFollowUpDate);
  const [stage, setStage] = useState(initialStage);
  const [leadScore, setLeadScore] = useState(String(initialLeadScore));
  const [leadSource, setLeadSource] = useState(initialLeadSource);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateInquiry(id, {
      status,
      adminNotes,
      priority,
      followUpDate: followUpDate || null,
      stage,
      leadScore: Number(leadScore) || 0,
      leadSource: leadSource || null,
    });
    setSaving(false);

    if (result.success) {
      setFeedback({ type: 'success', text: 'Saved.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save.' });
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-5">
      <h2 className="font-semibold text-[#00342b]">Admin Actions</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          >
            {INQUIRY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="stage">
            Sales Stage
          </label>
          <select
            id="stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          >
            {PRIORITY_LEVELS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="leadScore">
            Lead Score (0–100)
          </label>
          <input
            id="leadScore"
            type="number"
            min={0}
            max={100}
            value={leadScore}
            onChange={(e) => setLeadScore(e.target.value)}
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="leadSource">
            Lead Source
          </label>
          <select
            id="leadSource"
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          >
            <option value="">Not set</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="followUpDate">
            Follow-Up Date
          </label>
          <input
            id="followUpDate"
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="adminNotes">
          Internal Admin Notes
        </label>
        <textarea
          id="adminNotes"
          rows={5}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="Notes visible only to BizLink Africa admins..."
          className="w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none resize-none"
        />
      </div>

      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
