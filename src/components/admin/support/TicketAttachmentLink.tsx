'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { getTicketAttachmentUrl } from '@/app/admin/(protected)/support-tickets/actions';

export default function TicketAttachmentLink({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    const result = await getTicketAttachmentUrl(filePath);
    setPending(false);
    if (result.success && result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00342b] hover:underline disabled:opacity-60"
    >
      <Download size={12} /> {pending ? 'Preparing...' : fileName}
    </button>
  );
}
