'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createKbCategory } from '@/app/admin/(protected)/support/knowledge-base/actions';

export default function CreateKbCategoryForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createKbCategory(name, description);
    setSubmitting(false);
    if (result.success) {
      setName('');
      setDescription('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create category.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" required className={inputClass} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className={inputClass} />
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Adding...' : 'Add Category'}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
