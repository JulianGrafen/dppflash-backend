-- Staging merge audit columns (Phase 2).

begin;

alter table public.staging_events
  add column if not exists merged_upi text,
  add column if not exists processed_at timestamptz,
  add column if not exists merge_error text;

commit;
