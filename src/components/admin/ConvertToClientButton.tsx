'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck } from 'lucide-react';
import { convertLeadToClient } from '@/app/admin/(protected)/actions';

export default function ConvertToClientButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setPending(true);
    setError(null);
    const result = await convertLeadToClient(leadId);
    setPending(false);

    if (result.success && result.clientId) {
      router.push(`/admin/clients/${result.clientId}`);
    } else {
      setError(result.message ?? 'Failed to convert lead to client.');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-2 text-xs font-medium bg-[#00342b] text-white px-3 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        <UserCheck size={14} /> {pending ? 'Converting...' : 'Convert to Client'}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
