-- DPP persistence baseline migration
-- Creates storage buckets and relational persistence for
-- uploaded documents and extracted digital product passports.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('pdf-uploads', 'pdf-uploads', false),
  ('extracted-data', 'extracted-data', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Utility trigger for updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core table: uploaded source documents
-- ---------------------------------------------------------------------------

create table if not exists public.dpp_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  mime_type text not null default 'application/pdf',
  storage_path text not null,
  extraction_status text not null default 'PENDING'
    check (extraction_status in ('PENDING', 'EXTRACTED', 'VALIDATED', 'FAILED')),
  extracted_text text,
  extraction_duration_ms integer check (extraction_duration_ms is null or extraction_duration_ms >= 0),
  page_count integer check (page_count is null or page_count >= 0),
  error_message text,
  uploaded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_dpp_documents_tenant_uploaded_at
  on public.dpp_documents (tenant_id, uploaded_at desc);

create index if not exists idx_dpp_documents_status
  on public.dpp_documents (extraction_status);

drop trigger if exists trg_dpp_documents_updated_at on public.dpp_documents;
create trigger trg_dpp_documents_updated_at
before update on public.dpp_documents
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Core table: extracted product passports
-- ---------------------------------------------------------------------------

create table if not exists public.dpp_passports (
  id text primary key,
  tenant_id text not null,
  document_id uuid references public.dpp_documents(id) on delete set null,
  product_type text not null,
  schema_version text,
  upi text,
  gtin text,
  confidence numeric(5,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null
    check (status in ('SUCCESS', 'PARTIAL', 'FAILED')),
  warnings jsonb not null default '[]'::jsonb,
  dpp_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_dpp_passports_tenant_created_at
  on public.dpp_passports (tenant_id, created_at desc);

create index if not exists idx_dpp_passports_document_id
  on public.dpp_passports (document_id);

create index if not exists idx_dpp_passports_upi
  on public.dpp_passports (upi);

create index if not exists idx_dpp_passports_gtin
  on public.dpp_passports (gtin);

create index if not exists idx_dpp_passports_payload_gin
  on public.dpp_passports using gin (dpp_payload);

drop trigger if exists trg_dpp_passports_updated_at on public.dpp_passports;
create trigger trg_dpp_passports_updated_at
before update on public.dpp_passports
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + service-role policies
-- ---------------------------------------------------------------------------

alter table public.dpp_documents enable row level security;
alter table public.dpp_passports enable row level security;

drop policy if exists service_role_all_dpp_documents on public.dpp_documents;
create policy service_role_all_dpp_documents
on public.dpp_documents
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_dpp_passports on public.dpp_passports;
create policy service_role_all_dpp_passports
on public.dpp_passports
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists service_role_all_storage_objects on storage.objects;
create policy service_role_all_storage_objects
on storage.objects
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
