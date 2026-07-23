import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import TicketAttachmentLink from '@/components/admin/support/TicketAttachmentLink';
import type { TicketAttachment } from '@/data/tickets';

export const dynamic = 'force-dynamic';

interface ConversationRow {
  id: string;
  ticket_id: string;
  author: string;
  message: string;
  created_at: string;
  support_tickets: { ticket_number: string | null; title: string; clients: { client_name: string } | null } | null;
}

export default async function CustomerConversationsPage() {
  try {
    await requirePermission('tickets.view');
  } catch {
    return <AccessDenied requiredPermission="tickets.view" />;
  }

  const supabase = await createClient();

  // is_internal = false is structural, not a UI filter — internal notes
  // never even leave the database for this query, so there is no code
  // path here that could accidentally render one.
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select('id, ticket_id, author, message, created_at, support_tickets(ticket_number, title, clients(client_name))')
    .eq('is_internal', false)
    .order('created_at', { ascending: false })
    .limit(100);

  const messages = (data ?? []) as unknown as ConversationRow[];
  const messageIds = messages.map((m) => m.id);
  const { data: attachments } = messageIds.length
    ? await supabase.from('support_ticket_attachments').select('*').in('message_id', messageIds)
    : { data: [] };
  const attachmentsByMessage = new Map<string, TicketAttachment[]>();
  for (const a of (attachments ?? []) as TicketAttachment[]) {
    attachmentsByMessage.set(a.message_id, [...(attachmentsByMessage.get(a.message_id) ?? []), a]);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Customer Conversations</h1>
        <p className="text-sm text-[#707975] mt-1">
          The most recent {messages.length} client-visible replies across every ticket — internal notes are never shown here.
        </p>
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load conversations: {error.message}
        </p>
      )}

      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="bg-white border border-[#bfc9c4] p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <Link href={`/admin/support-tickets/${m.ticket_id}`} className="text-sm font-medium text-[#00342b] hover:underline">
                {m.support_tickets?.ticket_number ?? m.support_tickets?.title ?? 'Ticket'} — {m.support_tickets?.clients?.client_name ?? 'Unknown client'}
              </Link>
              <span className="text-xs text-[#707975]">{new Date(m.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <p className="text-xs text-[#707975] mb-1">{m.author}</p>
            <p className="text-sm text-[#3f4945] whitespace-pre-wrap">{m.message}</p>
            {(attachmentsByMessage.get(m.id) ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-3">
                {(attachmentsByMessage.get(m.id) ?? []).map((a) => (
                  <TicketAttachmentLink key={a.id} filePath={a.file_path} fileName={a.file_name} />
                ))}
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && !error && (
          <p className="text-sm text-[#707975] bg-white border border-[#bfc9c4] px-4 py-10 text-center">No client-visible messages yet.</p>
        )}
      </div>
    </div>
  );
}
