-- Supplier outreach magic-link sessions and submitted gap responses.

begin;

create table if not exists public.supplier_outreach_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  product_identifier text,
  recipient_email text not null,
  supplier_name text,
  gaps jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'expired')),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  submitted_payload jsonb,
  submitted_at timestamptz
);

create index if not exists idx_supplier_outreach_sessions_status
  on public.supplier_outreach_sessions (status);

create index if not exists idx_supplier_outreach_sessions_product
  on public.supplier_outreach_sessions (product_identifier);

commit;
