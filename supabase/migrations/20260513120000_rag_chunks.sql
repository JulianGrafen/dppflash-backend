-- Persistent RAG chunk index (embeddings + tokens for hybrid retrieval)

begin;

create table if not exists public.rag_chunks (
  id text primary key,
  tenant_id text not null,
  file_name text not null,
  page_number integer not null check (page_number >= 1),
  chunk_text text not null,
  tokens text[] not null default '{}',
  embedding double precision[] not null check (cardinality(embedding) = 1536),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_rag_chunks_tenant_id
  on public.rag_chunks (tenant_id);

create index if not exists idx_rag_chunks_tenant_file
  on public.rag_chunks (tenant_id, file_name);

alter table public.rag_chunks enable row level security;

drop policy if exists service_role_all_rag_chunks on public.rag_chunks;
create policy service_role_all_rag_chunks
on public.rag_chunks
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;
