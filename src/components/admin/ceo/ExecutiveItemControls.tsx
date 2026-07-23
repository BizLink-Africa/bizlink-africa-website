'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addExecutiveComment, assignFollowUp } from '@/app/admin/(protected)/ceo/actions/actions';

type Mode = null | 'comment' | 'assign' | 'escalate';

const inputClass = 'w-full border border-[#bfc9c4] px-2 py-1.5 text-xs focus:border-[#00342b] focus:outline-none';
const btnClass = 'text-xs font-medium px-2.5 py-1 border transition-colors disabled:opacity-60';

// Uniform Comment / Assign Follow-up / Escalate controls for every item in
// the Executive Action Center, Pending Approvals, and Company Alerts pages —
// these three actions don't belong to any single domain's own status
// machine (a comment doesn't change a contract's status), so they're built
// once here rather than duplicated per item type. Real approve/reject
// decisions are handled separately by each domain's own existing action
// component (ContractActionButtons, ExpenseApprovalQueueButtons, etc.).
export default function ExecutiveItemControls({
  module,
  id,
  title,
  href,
}: {
  module: string;
  id: string;
  title: string;
  href: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode(null);
    setText('');
    setAssignee('');
    setError(null);
  };

  const submitComment = async () => {
    if (!window.confirm('Add this comment to the record?')) return;
    setPending(true);
    setError(null);
    const result = await addExecutiveComment(module, id, title, href, text);
    setPending(false);
    if (result.success) {
      reset();
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save comment.');
    }
  };

  const submitFollowUp = async (actionType: 'assign' | 'escalate') => {
    const confirmMessage = actionType === 'escalate' ? 'Escalate this item?' : 'Assign this item for follow-up?';
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    setError(null);
    const result = await assignFollowUp({
      sourceModule: module,
      sourceId: id,
      itemTitle: title,
      href,
      actionType,
      assignedTo: assignee,
      note: text || undefined,
    });
    setPending(false);
    if (result.success) {
      reset();
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save.');
    }
  };

  if (mode === null) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        <button type="button" onClick={() => setMode('comment')} className={`${btnClass} border-[#bfc9c4] text-[#3f4945] hover:bg-[#f5f3f3]`}>
          Comment
        </button>
        <button type="button" onClick={() => setMode('assign')} className={`${btnClass} border-[#bfc9c4] text-[#3f4945] hover:bg-[#f5f3f3]`}>
          Assign Follow-up
        </button>
        <button type="button" onClick={() => setMode('escalate')} className={`${btnClass} border-red-200 text-red-700 hover:bg-red-50`}>
          Escalate
        </button>
      </div>
    );
  }

  if (mode === 'comment') {
    return (
      <div className="mt-2 space-y-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment"
          rows={2}
          className={inputClass}
          autoFocus
        />
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-1.5">
          <button type="button" disabled={pending || !text.trim()} onClick={submitComment} className={`${btnClass} bg-[#00342b] text-white border-[#00342b] hover:bg-[#004d40]`}>
            {pending ? 'Saving...' : 'Save Comment'}
          </button>
          <button type="button" onClick={reset} className={`${btnClass} border-[#bfc9c4] text-[#707975]`}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <input
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        placeholder="Assign to (staff email)"
        className={inputClass}
        autoFocus
      />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Note (optional)" rows={2} className={inputClass} />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={pending || !assignee.trim()}
          onClick={() => submitFollowUp(mode)}
          className={`${btnClass} bg-[#00342b] text-white border-[#00342b] hover:bg-[#004d40]`}
        >
          {pending ? 'Saving...' : mode === 'escalate' ? 'Confirm Escalate' : 'Confirm Assign'}
        </button>
        <button type="button" onClick={reset} className={`${btnClass} border-[#bfc9c4] text-[#707975]`}>
          Cancel
        </button>
      </div>
    </div>
  );
}
