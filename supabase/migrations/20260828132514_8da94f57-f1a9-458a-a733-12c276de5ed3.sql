create or replace function public.compras_estoque_listar(
  _busca text default null,
  _status text default 'alerta',
  _categoria text default null,
  _ordem text default 'saidas_desc',
  _limite integer default 15,
  _offset integer default 0
)
returns table (
  id uuid,
  codigo text,
  nome text,
  categoria text,
  unidade text,
  quantidade_atual numeric,
  quantidade_minima numeric,
  status text,
  saidas numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with permitido as (
    select (public.has_module_access(auth.uid(), 'compras') or public.has_module_access(auth.uid(), 'estoque')) as ok
  ),
  base as (
    select i.*
    from public.itens i, permitido p
    where p.ok
      and (
        _status is null or _status = 'todos'
        or (_status = 'alerta' and i.status::text in ('baixo_estoque','sem_estoque'))
        or i.status::text = _status
      )
      and (_categoria is null or _categoria = '' or i.categoria = _categoria)
      and (
        _busca is null or btrim(_busca) = ''
        or i.nome ilike '%' || _busca || '%'
        or i.codigo ilike '%' || _busca || '%'
      )
  ),
  saidas_diretas as (
    select m.item_id, sum(m.quantidade)::numeric as qtd
    from public.movimentacoes m
    where m.tipo = 'saida' and m.item_id is not null
    group by m.item_id
  ),
  saidas_multi as (
    select mi.item_id, sum(mi.quantidade)::numeric as qtd
    from public.movimentacao_itens mi
    join public.movimentacoes m on m.id = mi.movimentacao_id
    where m.tipo = 'saida'
    group by mi.item_id
  ),
  saidas_tot as (
    select item_id, sum(qtd) as qtd
    from (select * from saidas_diretas union all select * from saidas_multi) u
    group by item_id
  ),
  enriquecido as (
    select b.id, b.codigo, b.nome, b.categoria, b.unidade,
           b.quantidade_atual::numeric, b.quantidade_minima::numeric,
           b.status::text as status,
           coalesce(s.qtd, 0)::numeric as saidas,
           count(*) over () as total_count
    from base b
    left join saidas_tot s on s.item_id = b.id
  )
  select *
  from enriquecido
  order by
    case when _ordem = 'saidas_desc' then saidas end desc nulls last,
    case when _ordem = 'saidas_asc' then saidas end asc nulls last,
    case when _ordem = 'saldo_asc' then quantidade_atual end asc nulls last,
    case when _ordem = 'nome' then nome end asc nulls last,
    nome asc
  limit greatest(coalesce(_limite, 15), 1)
  offset greatest(coalesce(_offset, 0), 0)
$$;

grant execute on function public.compras_estoque_listar(text, text, text, text, integer, integer) to authenticated;

create or replace function public.compras_estoque_resumo()
returns table (sem_estoque bigint, baixo_estoque bigint, disponivel bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where i.status::text = 'sem_estoque'),
    count(*) filter (where i.status::text = 'baixo_estoque'),
    count(*) filter (where i.status::text = 'disponivel'),
    count(*)
  from public.itens i
  where public.has_module_access(auth.uid(), 'compras') or public.has_module_access(auth.uid(), 'estoque')
$$;

grant execute on function public.compras_estoque_resumo() to authenticated;