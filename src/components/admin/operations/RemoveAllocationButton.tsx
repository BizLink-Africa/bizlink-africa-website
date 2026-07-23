'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { deleteResourceAllocation } from '@/app/admin/(protected)/operations/resources/actions';

export default function RemoveAllocationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleRemove = async () => {
    if (!window.confirm('Remove this allocation?')) return;
    setPending(true);
    const result = await deleteResourceAllocation(id);
    setPending(false);
    if (result.success) router.refresh();
  };

  return (
    <button type="button" onClick={handleRemove} disabled={pending} className="text-[#707975] hover:text-red-700">
      <X size={14} />
    </button>
  );
}
