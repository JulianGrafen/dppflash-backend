-- Product matching: link PDF enrichments to Excel/ERP master rows.

begin;

alter table public.product_passports
  add column if not exists match_status text not null default 'master'
    check (match_status in ('master', 'enriched', 'unmatched'));

alter table public.product_passports
  add column if not exists master_upi text;

alter table public.product_passports
  add column if not exists matched_by text
    check (matched_by is null or matched_by in ('upi', 'gtin', 'manual'));

create index if not exists idx_product_passports_match_status
  on public.product_passports (tenant_id, match_status);

commit;
