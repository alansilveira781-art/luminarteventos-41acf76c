create or replace function public.compras_estoque_categorias()
returns table (categoria text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct i.categoria
  from public.itens i
  where i.categoria is not null and btrim(i.categoria) <> ''
    and (public.has_module_access(auth.uid(), 'compras') or public.has_module_access(auth.uid(), 'estoque'))
  order by 1
$$;

revoke execute on function public.compras_estoque_categorias() from public, anon;
grant execute on function public.compras_estoque_categorias() to authenticated;