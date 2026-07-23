'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead } from '@/app/admin/(protected)/notifications/actions';

export default function MarkAllReadButton({ unreadIds }: { unreadIds: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (unreadIds.length === 0) return null;

  const handleClick = async () => {
    setPending(true);
    await markAllNotificationsRead(unreadIds);
    setPending(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-sm font-medium px-3 py-2 bg-[#00342b] text-white hover:bg-[#004d40] transition-colors disabled:opacity-60"
    >
      {pending ? 'Saving...' : `Mark all as read (${unreadIds.length})`}
    </button>
  );
}
