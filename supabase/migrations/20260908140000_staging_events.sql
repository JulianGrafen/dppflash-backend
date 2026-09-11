-- Inbound staging area: triage events before merge into product_passports.

begin;

create table if not exists public.staging_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  source text not null
    check (source in ('ERP_WEBHOOK', 'CSV_UPLOAD', 'PDF_EXTRACT', 'PIM_WEBHOOK')),
  extracted_upi text,
  payload jsonb not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ORPHAN', 'CONFLICT', 'PROCESSED')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_staging_events_tenant_status
  on public.staging_events (tenant_id, status, created_at desc);

create index if not exists idx_staging_events_upi
  on public.staging_events (tenant_id, extracted_upi)
  where extracted_upi is not null;

alter table public.staging_events enable row level security;

create policy staging_events_tenant_read on public.staging_events
  for select
  using (true);

commit;
