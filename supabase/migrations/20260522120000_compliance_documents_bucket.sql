-- Öffentlicher Bucket für Compliance-PDFs (SDB / technische Merkblätter) im DPP.

begin;

insert into storage.buckets (id, name, public)
values ('compliance-documents', 'compliance-documents', true)
on conflict (id) do update set public = excluded.public;

commit;
