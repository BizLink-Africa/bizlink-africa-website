'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createKbArticle } from '@/app/admin/(protected)/support/knowledge-base/actions';
import { TICKET_CATEGORIES, KB_VISIBILITY, type TicketCategory, type KbVisibility } from '@/data/tickets';

interface CategoryOption {
  id: string;
  name: string;
}

export default function CreateKbArticleForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [visibility, setVisibility] = useState<KbVisibility>('internal');
  const [relatedCategories, setRelatedCategories] = useState<TicketCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRelated = (cat: TicketCategory) => {
    setRelatedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createKbArticle({ title, content, categoryId: categoryId || undefined, visibility, relatedCategories });
    setSubmitting(false);
    if (result.success) {
      setTitle('');
      setContent('');
      setCategoryId('');
      setRelatedCategories([]);
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to create article.');
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">
        <Plus size={14} /> New Article
      </button>
    );
  }

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';
  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#bfc9c4] p-5 space-y-4 w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">New Knowledge Base Article</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[#707975] hover:text-[#00342b]"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="categoryId">Category</label>
          <select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="visibility">Visibility</label>
          <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as KbVisibility)} className={inputClass}>
            {KB_VISIBILITY.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Related Ticket Categories</label>
          <div className="flex flex-wrap gap-2">
            {TICKET_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleRelated(c.value)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  relatedCategories.includes(c.value) ? 'bg-[#00342b] text-white border-[#00342b]' : 'text-[#3f4945] border-[#bfc9c4] hover:bg-[#f5f3f3]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="content">Content</label>
          <textarea id="content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} required className={`${inputClass} resize-none`} />
        </div>
      </div>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
      <button type="submit" disabled={submitting} className="bg-[#00342b] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
        {submitting ? 'Creating...' : 'Create Article'}
      </button>
    </form>
  );
}
