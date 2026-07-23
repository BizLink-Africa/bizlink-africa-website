'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateEscalationRule } from '@/app/admin/(protected)/support/settings/actions';
import { labelFor } from '@/data/tickets';
import { PRIORITY_LEVELS } from '@/data/inquiries';

export default function EscalationRuleRow({
  priority,
  initialEscalateAfterHours,
  initialEscalateToRole,
  roleOptions,
  canManage,
}: {
  priority: string;
  initialEscalateAfterHours: number;
  initialEscalateToRole: string | null;
  roleOptions: { value: string; label: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [hours, setHours] = useState(String(initialEscalateAfterHours));
  const [role, setRole] = useState(initialEscalateToRole ?? roleOptions[0]?.value ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!canManage) {
    return (
      <tr className="border-b border-[#e5e5e5] last:border-0">
        <td className="py-2 text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, priority)}</td>
        <td className="py-2 text-[#3f4945]">{initialEscalateAfterHours}h</td>
        <td className="py-2 text-[#3f4945]">{roleOptions.find((r) => r.value === initialEscalateToRole)?.label ?? initialEscalateToRole ?? '—'}</td>
        <td />
      </tr>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateEscalationRule(priority, Number(hours) || 0, role);
    setSaving(false);
    setFeedback(result.success ? 'Saved' : result.message ?? 'Failed');
    if (result.success) router.refresh();
  };

  return (
    <tr className="border-b border-[#e5e5e5] last:border-0">
      <td className="py-2 text-[#3f4945] capitalize">{labelFor(PRIORITY_LEVELS, priority)}</td>
      <td className="py-2">
        <input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} className="w-20 border border-[#bfc9c4] px-2 py-1.5 text-sm focus:border-[#00342b] focus:outline-none" /> h
      </td>
      <td className="py-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-[#bfc9c4] px-2 py-1.5 text-sm focus:border-[#00342b] focus:outline-none">
          {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </td>
      <td className="py-2">
        <button type="button" onClick={handleSave} disabled={saving} className="bg-[#00342b] text-white px-3 py-1.5 text-xs font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {feedback && <span className="ml-2 text-xs text-[#707975]">{feedback}</span>}
      </td>
    </tr>
  );
}
