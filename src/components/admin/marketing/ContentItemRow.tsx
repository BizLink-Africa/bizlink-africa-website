'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import InlineSelect from '@/components/admin/InlineSelect';
import { CONTENT_STATUSES, APPROVAL_STATUSES, CAMPAIGN_CHANNELS, CONTENT_TYPES, labelFor, type ContentCalendarItem } from '@/data/marketing';
import { updateContentCalendarStatus, updateContentApprovalStatus, updateContentPublishedLink } from '@/app/admin/(protected)/marketing/content-calendar/actions';

export default function ContentItemRow({ item, ownerName, campaignName, readOnly }: { item: ContentCalendarItem; ownerName: string; campaignName: string; readOnly: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [publishedLink, setPublishedLink] = useState(item.published_link ?? '');
  const [performanceNotes, setPerformanceNotes] = useState(item.performance_notes ?? '');
  const [saving, setSaving] = useState(false);

  const statusOptions = CONTENT_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  const approvalOptions = APPROVAL_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  const handleSavePerformance = async () => {
    setSaving(true);
    await updateContentPublishedLink(item.id, publishedLink, performanceNotes);
    setSaving(false);
    router.refresh();
  };

  return (
    <>
      <tr className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
        <td className="px-4 py-3 font-medium text-[#1b1c1c]">{item.title}</td>
        <td className="px-4 py-3 text-[#3f4945]">{labelFor(CONTENT_TYPES, item.content_type)}</td>
        <td className="px-4 py-3 text-[#3f4945]">{item.channel ? labelFor(CAMPAIGN_CHANNELS, item.channel) : '—'}</td>
        <td className="px-4 py-3 text-[#3f4945]">{campaignName}</td>
        <td className="px-4 py-3 text-[#3f4945]">{ownerName}</td>
        <td className="px-4 py-3 text-[#3f4945]">{item.planned_date ?? '—'}</td>
        <td className="px-4 py-3">
          {readOnly ? labelFor(CONTENT_STATUSES, item.status) : (
            <InlineSelect value={item.status} options={statusOptions} onSave={(v) => updateContentCalendarStatus(item.id, v as ContentCalendarItem['status'])} />
          )}
        </td>
        <td className="px-4 py-3">
          {readOnly ? labelFor(APPROVAL_STATUSES, item.approval_status) : (
            <InlineSelect value={item.approval_status} options={approvalOptions} onSave={(v) => updateContentApprovalStatus(item.id, v as ContentCalendarItem['approval_status'])} />
          )}
        </td>
        <td className="px-4 py-3">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[#00342b] hover:text-[#004d40]">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#e5e5e5] bg-[#f9faf9]">
          <td colSpan={9} className="px-4 py-4">
            {readOnly ? (
              <div className="text-sm text-[#3f4945] space-y-1">
                <p><span className="font-semibold text-[#707975]">Published Link:</span> {item.published_link ?? '—'}</p>
                <p><span className="font-semibold text-[#707975]">Performance:</span> {item.performance_notes ?? '—'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={publishedLink} onChange={(e) => setPublishedLink(e.target.value)} placeholder="Published link" className={inputClass} />
                <input value={performanceNotes} onChange={(e) => setPerformanceNotes(e.target.value)} placeholder="Performance notes" className={inputClass} />
                <button type="button" onClick={handleSavePerformance} disabled={saving} className="sm:col-span-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60 w-fit">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
