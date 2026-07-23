import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateKbArticleForm from '@/components/admin/support/CreateKbArticleForm';
import CreateKbCategoryForm from '@/components/admin/support/CreateKbCategoryForm';
import KbArticleStatusSelect from '@/components/admin/support/KbArticleStatusSelect';
import { TICKET_CATEGORIES, KB_VISIBILITY, labelFor, type KbArticle } from '@/data/tickets';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  let canManage = true;
  try {
    await requirePermission('knowledge_base.view');
  } catch {
    return <AccessDenied requiredPermission="knowledge_base.view" />;
  }
  try {
    await requirePermission('knowledge_base.manage');
  } catch {
    canManage = false;
  }

  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('kb_articles').select('*').order('updated_at', { ascending: false });
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,]/g, '')}%,content.ilike.%${q.replace(/[%,]/g, '')}%`);

  const [{ data: articles, error }, { data: categories }] = await Promise.all([
    query,
    supabase.from('kb_categories').select('id, name').order('name'),
  ]);

  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const rows = (articles ?? []) as KbArticle[];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Knowledge Base</h1>
          <p className="text-sm text-[#707975] mt-1">{rows.length} article{rows.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && <CreateKbArticleForm categories={categories ?? []} />}
      </div>

      {canManage && (
        <div className="mb-6 bg-white border border-[#bfc9c4] p-4">
          <CreateKbCategoryForm />
        </div>
      )}

      <form className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title or content..."
          className="flex-1 border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        />
        <button type="submit" className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors">Search</button>
      </form>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">Failed to load articles: {error.message}</p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Related Ticket Categories</th>
              <th className="px-4 py-3">Visibility</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">{a.title}</td>
                <td className="px-4 py-3 text-[#3f4945]">{a.category_id ? categoryNameById.get(a.category_id) ?? '—' : '—'}</td>
                <td className="px-4 py-3 text-[#3f4945] text-xs">{a.related_categories.map((c) => labelFor(TICKET_CATEGORIES, c)).join(', ') || '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{labelFor(KB_VISIBILITY, a.visibility)}</td>
                <td className="px-4 py-3">
                  {canManage ? <KbArticleStatusSelect id={a.id} status={a.status} /> : a.status}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#707975]">No articles yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
