'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { createClientContact, deleteClientContact } from '@/app/admin/(protected)/crm/contacts/actions';
import type { ClientContact } from '@/data/crm';

const initialForm = { fullName: '', roleTitle: '', email: '', phone: '', isPrimary: false };

export default function ClientContactsPanel({ clientId, contacts, canManage }: { clientId: string; contacts: ClientContact[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createClientContact({ clientId, ...form });
    setSubmitting(false);
    if (result.success) {
      setForm(initialForm);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to add contact.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this contact?')) return;
    await deleteClientContact(id, clientId);
    router.refresh();
  };

  const inputClass = 'w-full border border-[#bfc9c4] px-2.5 py-1.5 text-xs focus:border-[#00342b] focus:outline-none';

  return (
    <div className="bg-white border border-[#bfc9c4] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[#1b1c1c] text-sm">Contacts</h2>
        {canManage && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-[#00342b] hover:underline inline-flex items-center gap-1">
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-[#707975]">No contacts yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 border-b border-[#e5e5e5] last:border-0 pb-2 last:pb-0">
              <div>
                <p className="text-sm font-medium text-[#1b1c1c]">
                  {c.full_name} {c.is_primary && <span className="text-[10px] uppercase font-semibold text-[#1b7a3d] ml-1">Primary</span>}
                </p>
                <p className="text-xs text-[#707975]">{[c.role_title, c.email, c.phone].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              {canManage && (
                <button type="button" onClick={() => handleDelete(c.id)} className="text-[#707975] hover:text-red-700 shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-2 border-t border-[#e5e5e5] pt-3">
          <input placeholder="Full name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required className={inputClass} />
          <input placeholder="Role / Title" value={form.roleTitle} onChange={(e) => setForm((p) => ({ ...p, roleTitle: e.target.value }))} className={inputClass} />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
          <label className="flex items-center gap-1.5 text-xs text-[#3f4945]">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm((p) => ({ ...p, isPrimary: e.target.checked }))} />
            Primary contact
          </label>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className="text-xs font-medium bg-[#00342b] text-white px-3 py-1.5 hover:bg-[#004d40] disabled:opacity-60">
            {submitting ? 'Saving...' : 'Save Contact'}
          </button>
        </form>
      )}
    </div>
  );
}
