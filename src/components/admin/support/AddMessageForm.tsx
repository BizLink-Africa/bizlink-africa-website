'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addTicketMessage, uploadTicketAttachment } from '@/app/admin/(protected)/support-tickets/actions';

export default function AddMessageForm({ ticketId, isInternal }: { ticketId: string; isInternal: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await addTicketMessage(ticketId, { message, isInternal });

    if (!result.success || !result.id) {
      setSubmitting(false);
      setError(result.message ?? 'Failed to add message.');
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      const uploadResult = await uploadTicketAttachment(result.id, formData);
      if (!uploadResult.success) {
        setError(uploadResult.message ?? 'Message saved, but the attachment failed to upload.');
      }
    }

    setSubmitting(false);
    setMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh();
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder={isInternal ? 'Add an internal note (never visible to the client)...' : 'Reply to the client...'}
        required
        className={`${inputClass} resize-none`}
      />
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" className="text-xs text-[#707975]" />
        <button
          type="submit"
          disabled={submitting}
          className={`px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
            isInternal ? 'border border-[#bfc9c4] text-[#3f4945] hover:bg-[#f5f3f3]' : 'bg-[#00342b] text-white hover:bg-[#004d40]'
          }`}
        >
          {submitting ? 'Sending...' : isInternal ? 'Add Internal Note' : 'Send Reply'}
        </button>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
    </form>
  );
}
