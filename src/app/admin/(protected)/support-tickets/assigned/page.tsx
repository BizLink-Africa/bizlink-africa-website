import TicketListBody from '@/components/admin/support/TicketListBody';

export const dynamic = 'force-dynamic';

export default function AssignedTicketsPage() {
  return <TicketListBody filter="assigned" title="Assigned Tickets" description="Open tickets currently assigned to an agent" />;
}
