'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createAccessReview } from '@/app/admin/(protected)/compliance/access-reviews/actions';

const initialForm = {
  staffId: '',
  userLabel: '',
  roleLabel: '',
  department: '',
  permissionsSummary: '',
  findings: '',
  excessiveAccessFlag: false,
  reviewDate: new Date().toISOString().slice(0, 10),
  nextReviewDate: '',
};

interface StaffOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function AddAccessReviewForm({ staff }: { staff: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStaffSelect = (staffId: string) => {
    const selected = staff.find((s) => s.id === staffId);
    setForm((p) => ({
      ...p,
      staffId,
      userLabel: selected ? `${selected.full_name} (${selected.email})` : p.userLabel,
      roleLabel: selected?.role ?? p.roleLabel,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createAccessReview({
      ...form,
      staffId: form.staffId || undefined,
      roleLabel: form.roleLabel || undefined,
      department: form.department || undefined,
      permissionsSummary: form.permissionsSummary || undefined,
      findings: form.findings || undefined,
      reviewDate: form.reviewDate || undefined,
      nextReviewDate: form.nextReviewDate || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create access review.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors"
      >
        <Plus size={14} /> New Access Review
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Access Review</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="staffId">Staff Member (optional pre-fill)</label>
          <select id="staffId" value={form.staffId} onChange={(e) => handleStaffSelect(e.target.value)} className={inputClass}>
            <option value="">Enter manually below</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.email}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="userLabel">User</label>
          <input id="userLabel" value={form.userLabel} onChange={(e) => setForm((p) => ({ ...p, userLabel: e.target.value }))} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="roleLabel">Role</label>
          <input id="roleLabel" value={form.roleLabel} onChange={(e) => setForm((p) => ({ ...p, roleLabel: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="department">Department</label>
          <input id="department" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="reviewDate">Review Date</label>
          <input id="reviewDate" type="date" value={form.reviewDate} onChange={(e) => setForm((p) => ({ ...p, reviewDate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="nextReviewDate">Next Review Date</label>
          <input id="nextReviewDate" type="date" value={form.nextReviewDate} onChange={(e) => setForm((p) => ({ ...p, nextReviewDate: e.target.value }))} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="permissionsSummary">Permissions Summary (snapshot at review time)</label>
          <textarea id="permissionsSummary" value={form.permissionsSummary} onChange={(e) => setForm((p) => ({ ...p, permissionsSummary: e.target.value }))} rows={2} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="findings">Findings</label>
          <textarea id="findings" value={form.findings} onChange={(e) => setForm((p) => ({ ...p, findings: e.target.value }))} rows={2} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1b1c1c]">
            <input
              type="checkbox"
              checked={form.excessiveAccessFlag}
              onChange={(e) => setForm((p) => ({ ...p, excessiveAccessFlag: e.target.checked }))}
              className="accent-[#8a1f1f]"
            />
            Flag as excessive access (sends an alert email)
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}

      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Creating...' : 'Create Review'}
      </button>
    </form>
  );
}
