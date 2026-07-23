import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
}

interface ContactRow {
  id: string;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  client_id: string;
  clients: { business_name: string } | null;
}

export default async function ClientContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  try {
    await requirePermission('clients.view');
  } catch {
    return <AccessDenied requiredPermission="clients.view" />;
  }

  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('client_contacts')
    .select('id, full_name, role_title, email, phone, is_primary, client_id, clients(business_name)')
    .order('full_name');

  if (q) {
    const term = q.trim();
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const { data, error } = await query;
  const contacts = data as unknown as ContactRow[] | null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Client Contacts</h1>
        <p className="text-sm text-[#707975] mt-1">
          Company-wide contact directory. {contacts?.length ?? 0} contact{(contacts?.length ?? 0) === 1 ? '' : 's'}. Manage per-client on each client&apos;s detail page.
        </p>
      </div>

      <form className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, or phone…"
          className="w-full max-w-sm border border-[#bfc9c4] bg-white px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none"
        />
      </form>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load contacts: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c) => (
              <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                <td className="px-4 py-3 font-medium text-[#1b1c1c]">
                  {c.full_name} {c.is_primary && <span className="text-[10px] uppercase font-semibold text-[#1b7a3d] ml-1">Primary</span>}
                </td>
                <td className="px-4 py-3 text-[#3f4945]">{c.role_title ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{c.clients?.business_name ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-[#3f4945]">{c.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/clients/${c.client_id}`} className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors">
                    View Client
                  </Link>
                </td>
              </tr>
            ))}
            {(contacts ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#707975]">No contacts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
