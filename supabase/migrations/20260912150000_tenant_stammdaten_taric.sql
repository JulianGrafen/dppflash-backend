-- Optional default TARIC for tenant product passports (applied on persist when row has no taric_code).

begin;

alter table public.tenant_inbound_stammdaten
  add column if not exists taric_code text;

commit;
