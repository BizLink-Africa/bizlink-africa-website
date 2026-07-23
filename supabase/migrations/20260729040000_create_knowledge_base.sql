-- Knowledge Base: activates the knowledge_base.view/knowledge_base.manage
-- permissions already seeded (dormant) by the RBAC foundation migration —
-- this is that module actually shipping. related_categories lets an
-- article be surfaced against one or more of the existing ticket
-- categories (data/tickets.ts TICKET_CATEGORIES), not a separate taxonomy.

create table if not exists kb_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamp with time zone not null default now()
);

alter table kb_categories enable row level security;
create policy "knowledge_base.view can select kb_categories" on kb_categories for select to authenticated using (has_permission('knowledge_base.view'));
create policy "knowledge_base.manage can insert kb_categories" on kb_categories for insert to authenticated with check (has_permission('knowledge_base.manage'));
create policy "knowledge_base.manage can update kb_categories" on kb_categories for update to authenticated using (has_permission('knowledge_base.manage')) with check (has_permission('knowledge_base.manage'));

create table if not exists kb_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references kb_categories(id) on delete set null,
  title text not null,
  content text not null,
  status text not null default 'draft',
  visibility text not null default 'internal',
  related_categories text[] not null default '{}',
  created_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table kb_articles
  add constraint kb_articles_status_check check (status in ('draft', 'published'));
alter table kb_articles
  add constraint kb_articles_visibility_check check (visibility in ('internal', 'client_visible'));

create trigger kb_articles_set_updated_at
  before update on kb_articles
  for each row
  execute function set_updated_at();

alter table kb_articles enable row level security;
create policy "knowledge_base.view can select kb_articles" on kb_articles for select to authenticated using (has_permission('knowledge_base.view'));
create policy "knowledge_base.manage can insert kb_articles" on kb_articles for insert to authenticated with check (has_permission('knowledge_base.manage'));
create policy "knowledge_base.manage can update kb_articles" on kb_articles for update to authenticated using (has_permission('knowledge_base.manage')) with check (has_permission('knowledge_base.manage'));

insert into role_permissions (role_id, permission_id) values
  ('customer_support', 'knowledge_base.view'), ('customer_support', 'knowledge_base.manage'),
  ('ceo', 'knowledge_base.view')
on conflict do nothing;
