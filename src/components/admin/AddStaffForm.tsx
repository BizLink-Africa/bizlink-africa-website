'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { RoleOption } from '@/data/staff';
import { inviteStaff } from '@/app/admin/(protected)/staff/actions';

export default function AddStaffForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const initialForm = { fullName: '', email: '', role: roles[0]?.value ?? '' };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const result = await inviteStaff(form);
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setSuccessMessage(result.message ?? 'Invite sent.');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to invite staff member.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSuccessMessage(null);
        }}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> Invite Staff
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Invite Staff</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <p className="text-xs text-[#707975]">
        They&apos;ll get an email with a one-time link to set their password and sign in.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="role">Role</label>
          <select
            id="role"
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            className={inputClass}
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      {successMessage && (
        <p className="text-sm text-[#1b7a3d] bg-[#dcf5e3] border border-[#bfe5cc] px-3 py-2">{successMessage}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        {submitting ? 'Sending Invite...' : 'Send Invite'}
      </button>
    </form>
  );
}
