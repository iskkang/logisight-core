-- customs_nomenclature is reference data: public read, server-only write.
-- Explicit grants are required by current Supabase Data API defaults.
alter table public.customs_nomenclature enable row level security;

revoke all on table public.customs_nomenclature from anon, authenticated;
grant select on table public.customs_nomenclature to anon, authenticated;
grant select, insert, update, delete on table public.customs_nomenclature to service_role;

drop policy if exists "customs nomenclature public read" on public.customs_nomenclature;
create policy "customs nomenclature public read"
on public.customs_nomenclature
for select
to anon, authenticated
using (true);
