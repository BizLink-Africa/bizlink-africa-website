'use client';

export interface StaffOption {
  id: string;
  full_name: string;
}

// A plain controlled <select> of active staff — not self-saving, so it
// composes into any form context (a whole-form Save button, or an
// inline-save wrapper like InlineSelect). Replaces every free-text
// "assigned to" input this task touches.
export default function StaffPicker({
  id,
  value,
  onChange,
  staff,
  placeholder = 'Unassigned',
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  staff: StaffOption[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none'}
    >
      <option value="">{placeholder}</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.full_name}
        </option>
      ))}
    </select>
  );
}
