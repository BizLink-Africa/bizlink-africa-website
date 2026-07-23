-- Contract Management: contracts + version history for uploaded contract
-- files, backed by a private Supabase Storage bucket. "Expiring soon" and
-- "expired" are NOT stored statuses — they're computed from end_date at
-- display time (same approach as "overdue" invoices), avoiding the need for
-- a scheduled job to keep a stored status in sync with the calendar.
--
-- Simplification: the spec asked for both a full status list (which already
-- includes "Awaiting Signature" and "Signed" as states) AND a separate
-- "signature status" field. Folded into one status column to avoid two
-- overlapping sources of truth for the same real-world state.

-- ============================================================
-- 1. New permission: contract compliance review is distinct from final
--    approval (Compliance & Security reviews before CEO approves).
-- ============================================================

insert into permissions (id, module, description) values
  ('contracts.compliance_review', 'contracts', 'Mark a contract as compliance-reviewed before CEO approval')
on conflict (id) do nothing;

-- ============================================================
-- 2. Contracts
-- ============================================================

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique,
  contract_title text not null,

  client_id uuid references clients(id) on delete set null,
  lead_id uuid references website_leads(id) on delete set null,
  proforma_id uuid references proforma_invoices(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,

  start_date date,
  end_date date,
  renewal_date date,
  contract_value numeric(14,2),
  currency text not null default 'TZS',
  payment_terms text,

  contract_owner text,
  operations_owner text,

  status text not null default 'draft',
  signed_date date,
  renewal_notice_period_days int not null default 30,
  current_version int not null default 0,

  notes text,
  created_by text,
  approved_by text,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table contracts
  add constraint contracts_status_check check (status in (
    'draft', 'under_review', 'pending_compliance_review', 'pending_ceo_approval',
    'approved', 'sent_to_client', 'awaiting_signature', 'signed', 'active',
    'renewed', 'terminated', 'cancelled'
  ));

create trigger contracts_set_updated_at
  before update on contracts
  for each row
  execute function set_updated_at();

-- ============================================================
-- 3. Contract file versions
-- ============================================================

create table if not exists contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  version_number int not null,
  file_path text not null,
  file_name text not null,
  uploaded_by text,
  notes text,
  created_at timestamp with time zone not null default now(),
  unique (contract_id, version_number)
);

-- ============================================================
-- 4. Storage bucket for contract files (private — never public)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('contract-files', 'contract-files', false)
on conflict (id) do nothing;

create policy "contracts.view can read contract files"
  on storage.objects for select to authenticated
  using (bucket_id = 'contract-files' and has_permission('contracts.view'));

create policy "contracts.create/update can upload contract files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'contract-files' and (has_permission('contracts.create') or has_permission('contracts.update')));

-- ============================================================
-- 5. Permissions: grant to Operations (day-to-day), Compliance & Security
--    (review step), CEO (final approval), CFO (financial visibility only).
-- ============================================================

insert into role_permissions (role_id, permission_id) values
  ('operations', 'contracts.view'), ('operations', 'contracts.create'), ('operations', 'contracts.update'),
  ('operations', 'contracts.renew'),

  ('compliance_security', 'contracts.view'), ('compliance_security', 'contracts.compliance_review'),

  ('ceo', 'contracts.view'), ('ceo', 'contracts.approve'), ('ceo', 'contracts.terminate'),

  ('cfo', 'contracts.view')
on conflict do nothing;

-- ============================================================
-- 6. RLS
-- ============================================================

alter table contracts enable row level security;
create policy "contracts.view can select contracts" on contracts for select to authenticated using (has_permission('contracts.view'));
create policy "contracts.create can insert contracts" on contracts for insert to authenticated with check (has_permission('contracts.create'));
create policy "contracts can be updated by authorized roles" on contracts for update to authenticated
  using (
    has_permission('contracts.update') or has_permission('contracts.compliance_review') or
    has_permission('contracts.approve') or has_permission('contracts.renew') or has_permission('contracts.terminate')
  )
  with check (
    has_permission('contracts.update') or has_permission('contracts.compliance_review') or
    has_permission('contracts.approve') or has_permission('contracts.renew') or has_permission('contracts.terminate')
  );

alter table contract_versions enable row level security;
create policy "contracts.view can select contract versions" on contract_versions for select to authenticated using (has_permission('contracts.view'));
create policy "contracts.create/update can insert contract versions" on contract_versions for insert to authenticated
  with check (has_permission('contracts.create') or has_permission('contracts.update'));
