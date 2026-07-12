'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageCircle } from 'lucide-react';
import { updateInquiry } from '@/app/admin/(protected)/actions';

// Tanzania-first normalization: a locally-entered "0xxxxxxxxx" number is
// rewritten to the 255 country code wa.me expects. Numbers already given
// with a country code pass through untouched.
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `255${digits.slice(1)}` : digits;
}

const QUICK_STATUSES = [
  { value: 'contacted', label: 'Mark as Contacted' },
  { value: 'proposal_sent', label: 'Mark as Proposal Sent' },
  { value: 'offline_onboarding', label: 'Mark as Offline Onboarding' },
  { value: 'dormant', label: 'Mark as Dormant' },
  { value: 'rejected', label: 'Mark as Rejected' },
] as const;

export default function QuickActions({
  id,
  email,
  phone,
  businessName,
  lastContactedAt,
}: {
  id: string;
  email: string;
  phone: string;
  businessName: string;
  lastContactedAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleStatusClick = async (status: string) => {
    setPending(status);
    setFeedback(null);
    const result = await updateInquiry(id, { status });
    setPending(null);

    if (result.success) {
      setFeedback({ type: 'success', text: 'Status updated.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to update status.' });
    }
  };

  const whatsappHref = `https://wa.me/${toWhatsAppNumber(phone)}`;
  const mailtoHref = `mailto:${email}?subject=${encodeURIComponent(`Re: Your BizLink Africa inquiry — ${businessName}`)}`;

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <div>
        <h2 className="font-[Geist,sans-serif] font-semibold text-[#00342b]">Quick Actions</h2>
        <p className="text-xs text-[#707975] mt-1">
          Last contacted: {lastContactedAt ? new Date(lastContactedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={mailtoHref}
          className="inline-flex items-center gap-2 text-xs font-medium border border-[#bfc9c4] px-3 py-2 hover:border-[#00342b] hover:text-[#00342b] transition-colors"
        >
          <Mail size={14} /> Email Client
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs font-medium border border-[#bfc9c4] px-3 py-2 hover:border-[#00342b] hover:text-[#00342b] transition-colors"
        >
          <MessageCircle size={14} /> WhatsApp Client
        </a>
      </div>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-[#e5e5e5]">
        {QUICK_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => handleStatusClick(s.value)}
            disabled={pending !== null}
            className="text-xs font-medium bg-[#f5f3f3] border border-[#bfc9c4] px-3 py-2 hover:bg-[#00342b] hover:text-white hover:border-[#00342b] transition-colors disabled:opacity-60"
          >
            {pending === s.value ? 'Saving...' : s.label}
          </button>
        ))}
      </div>

      {feedback && (
        <p className={`text-sm px-3 py-2 border ${feedback.type === 'success' ? 'text-[#00342b] bg-[#e0f2ee] border-[#afefdd]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
