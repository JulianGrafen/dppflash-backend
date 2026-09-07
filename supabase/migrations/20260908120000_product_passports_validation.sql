-- ESPR validation results for inbound product passport drafts.

begin;

alter table public.product_passports
  add column if not exists validation_status text
    check (validation_status in ('pending', 'valid', 'invalid'));

alter table public.product_passports
  add column if not exists readiness_score_percent numeric(5, 1);

alter table public.product_passports
  add column if not exists validation_report jsonb;

alter table public.product_passports
  add column if not exists gaps jsonb;

alter table public.product_passports
  add column if not exists validated_at timestamptz;

create index if not exists idx_product_passports_validation_status
  on public.product_passports (tenant_id, validation_status);

commit;
