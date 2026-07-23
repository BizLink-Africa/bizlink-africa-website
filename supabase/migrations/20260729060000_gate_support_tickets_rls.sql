-- support_tickets/support_ticket_messages RLS predates the RBAC migration
-- and was only ever tightened to is_active_staff() (any active staff
-- member, regardless of role) — unlike every other module's tables, it
-- was never migrated to has_permission()-gated policies. Fixes that here,
-- alongside the matching page-level requirePermission() fix (see
-- support-tickets/page.tsx and actions.ts) — this module's "Permission
-- enforcement" only actually holds once both layers agree.

drop policy if exists "Active staff can view support tickets" on support_tickets;
drop policy if exists "Active staff can insert support tickets" on support_tickets;
drop policy if exists "Active staff can update support tickets" on support_tickets;

create policy "tickets.view can select support_tickets" on support_tickets for select to authenticated using (has_permission('tickets.view'));
create policy "tickets.create can insert support_tickets" on support_tickets for insert to authenticated with check (has_permission('tickets.create'));
create policy "support_tickets can be updated by authorized roles" on support_tickets for update to authenticated
  using (has_permission('tickets.update') or has_permission('tickets.assign') or has_permission('tickets.resolve') or has_permission('tickets.escalate'))
  with check (has_permission('tickets.update') or has_permission('tickets.assign') or has_permission('tickets.resolve') or has_permission('tickets.escalate'));

drop policy if exists "Active staff can view ticket messages" on support_ticket_messages;
drop policy if exists "Active staff can insert ticket messages" on support_ticket_messages;

create policy "tickets.view can select support_ticket_messages" on support_ticket_messages for select to authenticated using (has_permission('tickets.view'));
create policy "tickets.update can insert support_ticket_messages" on support_ticket_messages for insert to authenticated with check (has_permission('tickets.update'));
