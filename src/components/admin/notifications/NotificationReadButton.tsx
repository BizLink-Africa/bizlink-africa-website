'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markNotificationRead } from '@/app/admin/(protected)/notifications/actions';

export default function NotificationReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    await markNotificationRead(id);
    setPending(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium px-2.5 py-1.5 border border-[#00342b] text-[#00342b] hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60 whitespace-nowrap"
    >
      {pending ? 'Saving...' : 'Mark as read'}
    </button>
  );
}
