-- Tenant-level inbound Stammdaten (manually entered, not from product Excel rows).

begin;

create table if not exists public.tenant_inbound_stammdaten (
  tenant_id text primary key,
  hersteller text,
  herstelleradresse text,
  kontakt jsonb,
  eori text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.tenant_inbound_stammdaten enable row level security;

create policy tenant_inbound_stammdaten_read on public.tenant_inbound_stammdaten
  for select
  using (true);

commit;
