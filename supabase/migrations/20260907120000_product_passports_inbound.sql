-- Inbound funnel persistence: KMU Excel rows, PDF extractions, enterprise ingest.

begin;

create table if not exists public.product_passports (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  upi text not null,
  source text not null
    check (source in ('kmu_excel', 'pdf_extract', 'enterprise_ingest')),
  payload jsonb not null,
  raw_extraction jsonb,
  is_draft boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, upi)
);

create index if not exists idx_product_passports_tenant_created
  on public.product_passports (tenant_id, created_at desc);

create index if not exists idx_product_passports_source
  on public.product_passports (source);

drop trigger if exists trg_product_passports_updated_at on public.product_passports;
create trigger trg_product_passports_updated_at
before update on public.product_passports
for each row execute function public.set_updated_at();

alter table public.product_passports enable row level security;

-- Service-role clients bypass RLS; anon/authenticated need explicit policies later.
create policy product_passports_tenant_read on public.product_passports
  for select
  using (true);

commit;
