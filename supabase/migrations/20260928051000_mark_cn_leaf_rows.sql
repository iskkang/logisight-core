alter table public.customs_nomenclature
  add column if not exists is_leaf boolean not null default true;

update public.customs_nomenclature
set is_leaf = not (
  code ~ '^0{6}[0-9]{2}$'
  or description ~* '^(CAP[IÍ]TULO|SECCI[ÓO]N|PARTIDA|SUBPARTIDA)\b'
);

create index if not exists customs_nomenclature_leaf_idx
on public.customs_nomenclature (market,nomenclature,is_leaf,code);
