alter table public.compras  add column if not exists numeros_nf text[] not null default '{}';
alter table public.demandas add column if not exists numeros_nf text[] not null default '{}';

update public.compras
  set numeros_nf = array[numero_nf]
  where numero_nf is not null and numero_nf <> '' and coalesce(array_length(numeros_nf,1),0) = 0;

update public.demandas
  set numeros_nf = array[numero_nf]
  where numero_nf is not null and numero_nf <> '' and coalesce(array_length(numeros_nf,1),0) = 0;