import TicketListBody from '@/components/admin/support/TicketListBody';

export const dynamic = 'force-dynamic';

export default function UnassignedTicketsPage() {
  return <TicketListBody filter="unassigned" title="Unassigned Tickets" description="Open tickets with no agent assigned yet" />;
}
