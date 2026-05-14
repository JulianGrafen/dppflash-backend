-- Entity-centric RAG: canonical products + rag_chunks.product_id
-- tenant_id on products matches rag_chunks.tenant_id (application workspace key, text).

begin;

create extension if not exists pg_trgm;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint products_tenant_normalized_unique unique (tenant_id, normalized_name)
);

comment on table public.products is 'Canonical product entities for RAG; tenant_id aligns with rag_chunks.tenant_id.';
comment on column public.products.tenant_id is 'Application workspace / tenant key (text), identical in meaning to rag_chunks.tenant_id — not necessarily a Postgres uuid.';
comment on column public.products.normalized_name is 'Lowercase, diacritics-stripped, punctuation collapsed for matching.';

create index if not exists idx_products_tenant_normalized
  on public.products (tenant_id, normalized_name);

create index if not exists idx_products_normalized_trgm
  on public.products using gin (normalized_name gin_trgm_ops);

alter table public.products enable row level security;

drop policy if exists service_role_all_products on public.products;
create policy service_role_all_products
on public.products
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Optional FK from document chunks (implemented as rag_chunks in this project)
alter table public.rag_chunks
  add column if not exists product_id uuid references public.products (id) on delete set null;

create index if not exists idx_rag_chunks_tenant_product
  on public.rag_chunks (tenant_id, product_id)
  where product_id is not null;

-- Fuzzy match helper (pg_trgm similarity)
create or replace function public.match_product_by_similarity(
  p_tenant_id text,
  p_normalized text,
  p_min_similarity real default 0.42
)
returns table (id uuid, sim real)
language sql
stable
as $$
  select
    p.id,
    similarity(p.normalized_name, p_normalized)::real as sim
  from public.products p
  where p.tenant_id = p_tenant_id
    and p.normalized_name % p_normalized
    and similarity(p.normalized_name, p_normalized) >= p_min_similarity
  order by similarity(p.normalized_name, p_normalized) desc
  limit 1;
$$;

comment on function public.match_product_by_similarity is 'Best fuzzy product match per tenant using pg_trgm; used by ProductEntityService.';

-- Chunk rows live in `public.rag_chunks` (column `product_id`); no separate physical `document_chunks` table.

commit;
