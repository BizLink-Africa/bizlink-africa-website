'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { getContractFileUrl } from '@/app/admin/(protected)/contracts/actions';

export default function ContractFileDownloadLink({ filePath }: { filePath: string }) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    const result = await getContractFileUrl(filePath);
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
      <Download size={12} /> {pending ? 'Preparing...' : 'Download'}
    </button>
  );
}
