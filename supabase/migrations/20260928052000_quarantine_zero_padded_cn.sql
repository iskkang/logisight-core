update public.customs_nomenclature
set is_leaf = false
where market='EU' and nomenclature='CN'
  and code ~ '^0';
