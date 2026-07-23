'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const selectClass = 'border border-[#bfc9c4] bg-white px-2.5 py-1.5 text-xs focus:border-[#00342b] focus:outline-none';

export default function PendingApprovalsFilters({
  departments,
  actionTypes,
  assignees,
}: {
  departments: string[];
  actionTypes: string[];
  assignees: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const get = (key: string) => searchParams.get(key) ?? '';

  return (
    <div className="flex flex-wrap gap-2 bg-white border border-[#bfc9c4] p-3">
      <select value={get('department')} onChange={(e) => setParam('department', e.target.value)} className={selectClass}>
        <option value="">All Departments</option>
        {departments.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={get('actionType')} onChange={(e) => setParam('actionType', e.target.value)} className={selectClass}>
        <option value="">All Action Types</option>
        {actionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={get('priority')} onChange={(e) => setParam('priority', e.target.value)} className={selectClass}>
        <option value="">All Priorities</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>
      <select value={get('status')} onChange={(e) => setParam('status', e.target.value)} className={selectClass}>
        <option value="">All Statuses</option>
        <option value="unassigned">Unassigned</option>
        <option value="assigned">Assigned (Open)</option>
        <option value="done">Follow-up Done</option>
      </select>
      <select value={get('assignedTo')} onChange={(e) => setParam('assignedTo', e.target.value)} className={selectClass}>
        <option value="">Any Assigned Executive</option>
        {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-xs text-[#707975]">
        Submitted from
        <input type="date" value={get('from')} onChange={(e) => setParam('from', e.target.value)} className={selectClass} />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-[#707975]">
        to
        <input type="date" value={get('to')} onChange={(e) => setParam('to', e.target.value)} className={selectClass} />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-[#707975]">
        Deadline before
        <input type="date" value={get('deadlineBefore')} onChange={(e) => setParam('deadlineBefore', e.target.value)} className={selectClass} />
      </label>
    </div>
  );
}
