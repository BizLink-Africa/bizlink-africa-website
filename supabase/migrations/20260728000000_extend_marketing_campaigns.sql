-- Extends marketing_campaigns with the fields the fuller Marketing section
-- needs: a campaign type, real spend tracking (budget vs. actual), an
-- owner, and multi-channel support. `channel` (singular) stays as-is for
-- backward compat — `channels` is the new multi-select field the UI moves
-- to, backfilled from the existing single value so no campaign loses its
-- channel on upgrade. `objective`/`description` are relabeled "Goal"/
-- "Notes" in the UI only; no column rename.

alter table marketing_campaigns add column if not exists type text;
alter table marketing_campaigns add column if not exists actual_spend numeric(14,2) not null default 0;
alter table marketing_campaigns add column if not exists channels text[] not null default '{}';
alter table marketing_campaigns add column if not exists owner_user_id uuid references staff_profiles(id) on delete set null;

update marketing_campaigns set channels = array[channel] where channels = '{}';

alter table marketing_campaigns
  add constraint marketing_campaigns_type_check check (type is null or type in (
    'lead_generation', 'brand_awareness', 'product_launch', 'event', 'other'
  ));
