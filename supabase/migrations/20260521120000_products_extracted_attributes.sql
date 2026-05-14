-- Pre-computed per-document ESPR-style extractions (eager RAG), merged on `products`.

begin;

alter table public.products
  add column if not exists extracted_attributes jsonb not null default '{}'::jsonb;

comment on column public.products.extracted_attributes is
  'Eager-extracted field candidates from ingested PDFs: { "<camelCaseKey>": { "value": string|null, "sourcePdf": string, "contextSnippet": string, "pageNumber"?: number, "confidence": number } }. Merged by confidence on ingest.';

commit;
