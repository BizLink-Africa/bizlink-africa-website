-- Secure KYC Coordination module: document collection, internal review, and
-- submission-to-partner tracking. BizLink is never the final KYC approver —
-- merchant_kyc_reviews (from 20260806000000) already only ever RECORDS a
-- partner_decision reported back by the approved payment infrastructure
-- partner; this migration adds the document layer that feeds it.
--
-- Storage path convention for the merchant-kyc-documents bucket:
--   {merchant_id}/{document_type}/v{version}-{safe_filename}
-- storage.foldername(name) therefore gives [merchant_id, document_type] —
-- used below to gate the one document_type ('owner_director_id') that
-- needs a stricter, additional permission than the rest of the checklist.

-- ── Storage bucket (private — no public URLs) ───────────────────────────
insert into storage.buckets (id, name, public)
values ('merchant-kyc-documents', 'merchant-kyc-documents', false)
on conflict (id) do nothing;

-- SELECT backs createSignedUrl() — a caller can only ever get a signed URL
-- for a path they could SELECT. Identity-document paths require the
-- additional merchant_kyc_identity_documents.view permission on top of the
-- general one; this is real, storage-layer defense-in-depth, not just an
-- app-layer check the action *could* skip.
create policy "KYC documents readable with permission, identity docs need extra permission"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'merchant-kyc-documents'
    and has_permission('merchant_kyc_documents.view')
    and (
      (storage.foldername(name))[2] is distinct from 'owner_director_id'
      or has_permission('merchant_kyc_identity_documents.view')
    )
  );

create policy "KYC documents uploadable with manage permission"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'merchant-kyc-documents' and has_permission('merchant_kyc_documents.manage'));

-- Deliberately no UPDATE policy (a "replace" is always a new object/new
-- version row, never an in-place overwrite — see merchant_document_files
-- below) and no DELETE policy for authenticated at all — deletion only
-- ever happens through the service-role-backed deleteKycDocumentFile
-- action, so every deletion is a deliberate, audited, reason-required act.

-- ── merchant_documents: upgrade the existing checklist to the full spec ──
-- (table already exists from 20260806000000 with 4 statuses and 6 types —
-- this widens both rather than creating a duplicate table.)
alter table merchant_documents drop constraint if exists merchant_documents_status_check;

update merchant_documents set status = case status
  when 'pending' then 'not_requested'
  when 'received' then 'uploaded'
  when 'verified' then 'ready_for_submission'
  else status
end
where status in ('pending', 'received', 'verified');

alter table merchant_documents add constraint merchant_documents_status_check check (status in (
  'not_requested', 'requested', 'uploaded', 'under_internal_review', 'incomplete',
  'ready_for_submission', 'submitted_to_partner', 'additional_information_requested',
  'confirmed_by_partner', 'rejected', 'expired'
));
alter table merchant_documents alter column status set default 'not_requested';

-- ── merchant_document_files: versioned, audited file metadata ──────────
-- Never overwritten in place — each upload/replace inserts a new row and
-- flips the previous current row's is_current to false, so version history
-- (and its audit trail) is never lost. account_reference-style content
-- itself lives only in Storage, never duplicated into this table.
create table if not exists merchant_document_files (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  document_type text not null,
  version_number integer not null,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  mime_type text not null,
  is_current boolean not null default true,
  -- Placeholder for a real malware-scanning integration (e.g. ClamAV/
  -- VirusTotal/cloud AV) — no scanning actually happens yet. Never treat
  -- 'clean' here as a real security guarantee until that integration
  -- exists; see triggerMalwareScanPlaceholder()'s comment in actions.ts.
  malware_scan_status text not null default 'pending' check (malware_scan_status in ('pending', 'clean', 'flagged', 'skipped')),
  uploaded_by text not null,
  uploaded_at timestamp with time zone not null default now(),
  retention_expires_at timestamp with time zone,
  deleted_at timestamp with time zone,
  deleted_by text,
  deletion_reason text
);
alter table merchant_document_files enable row level security;
create index if not exists merchant_document_files_merchant_id_idx on merchant_document_files (merchant_id, document_type);

create policy "Staff can view KYC document file metadata with permission"
  on merchant_document_files for select to authenticated
  using (has_permission('merchant_kyc_documents.view') or has_permission('merchant_kyc_documents.metadata_view'));

create policy "Staff can insert KYC document file metadata with manage permission"
  on merchant_document_files for insert to authenticated
  with check (has_permission('merchant_kyc_documents.manage'));

create policy "Staff can update KYC document file metadata with manage permission"
  on merchant_document_files for update to authenticated
  using (has_permission('merchant_kyc_documents.manage'))
  with check (has_permission('merchant_kyc_documents.manage'));
-- No delete policy — deletion is a soft-delete (deleted_at/deleted_by/
-- deletion_reason) via UPDATE, done through the service-role action so the
-- accompanying storage.objects removal and audit_logs entry are atomic
-- from the caller's point of view.

-- ── merchant_data_processing_consent: append-only consent record ───────
create table if not exists merchant_data_processing_consent (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id),
  consent_given boolean not null,
  consent_text_version text not null,
  recorded_by text not null,
  recorded_at timestamp with time zone not null default now()
);
alter table merchant_data_processing_consent enable row level security;
create index if not exists merchant_data_processing_consent_merchant_id_idx on merchant_data_processing_consent (merchant_id);

create policy "Staff can view consent records with permission"
  on merchant_data_processing_consent for select to authenticated
  using (has_permission('merchant_kyc_documents.view') or has_permission('merchant_kyc_documents.metadata_view'));

create policy "Staff can insert consent records with manage permission"
  on merchant_data_processing_consent for insert to authenticated
  with check (has_permission('merchant_kyc_documents.manage'));
-- Append-only — a consent record is a historical event, never edited.

-- ── New role: Auditor (read-only metadata across the org, starting here) ──
insert into roles (id, name, is_active)
values ('auditor', 'Auditor', true)
on conflict (id) do nothing;

-- ── Permissions ──────────────────────────────────────────────────────────
insert into permissions (id, module, description) values
  ('merchant_kyc_documents.view', 'merchant_operations', 'View and access (signed URL) KYC documents, excluding identity documents'),
  ('merchant_kyc_documents.manage', 'merchant_operations', 'Request, upload, replace, and change status of KYC documents'),
  ('merchant_kyc_identity_documents.view', 'merchant_operations', 'View/access owner-director identity documents specifically (in addition to merchant_kyc_documents.view)'),
  ('merchant_kyc_documents.metadata_view', 'merchant_operations', 'Read-only: checklist status and file metadata only, no file access')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

insert into role_permissions (role_id, permission_id) values
  -- Compliance Officer: full KYC document access, including identity documents.
  ('compliance_security', 'merchant_kyc_documents.view'), ('compliance_security', 'merchant_kyc_documents.manage'),
  ('compliance_security', 'merchant_kyc_identity_documents.view'),

  -- Onboarding Staff: limited upload/review access — deliberately NOT
  -- granted merchant_kyc_identity_documents.view, so they can request,
  -- upload, and review the checklist but cannot open the identity document
  -- itself.
  ('operations', 'merchant_kyc_documents.view'), ('operations', 'merchant_kyc_documents.manage'),

  -- Finance Staff: settlement status only — no KYC document permissions
  -- at all. (merchant_beneficiaries.view, already granted in
  -- 20260806000000, is their "settlement status" visibility.)

  -- Support Staff: explicitly no KYC document access — no grants here.

  -- Auditor: read-only metadata only, never file content.
  ('auditor', 'merchant_kyc_documents.metadata_view'),
  ('auditor', 'merchants.view'), ('auditor', 'merchant_kyc.view'),
  ('auditor', 'merchant_tills.view'), ('auditor', 'audit.view'),

  -- CEO: same broad-but-metadata-only oversight pattern as Auditor, not
  -- full file-content access.
  ('ceo', 'merchant_kyc_documents.metadata_view')
on conflict do nothing;
