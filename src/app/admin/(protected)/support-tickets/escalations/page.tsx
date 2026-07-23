import TicketListBody from '@/components/admin/support/TicketListBody';

export const dynamic = 'force-dynamic';

export default function EscalationsPage() {
  return <TicketListBody filter="escalated" title="Escalations" description="Tickets currently escalated to an executive target" requiredPermission="tickets.escalate" />;
}
