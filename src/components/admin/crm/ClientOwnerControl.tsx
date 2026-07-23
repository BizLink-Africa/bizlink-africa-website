'use client';

import InlineSelect from '@/components/admin/InlineSelect';
import { assignClientOwner } from '@/app/admin/(protected)/clients/actions';
import type { StaffOption } from './StaffPicker';

export default function ClientOwnerControl({ id, accountOwnerId, staff }: { id: string; accountOwnerId: string | null; staff: StaffOption[] }) {
  const options = [{ value: '', label: 'Unassigned' }, ...staff.map((s) => ({ value: s.id, label: s.full_name }))];

  return (
    <div>
      <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Account Owner</label>
      <InlineSelect value={accountOwnerId ?? ''} options={options} onSave={(value) => assignClientOwner(id, value || null)} />
    </div>
  );
}
