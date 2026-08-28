revoke execute on function public.compras_estoque_listar(text, text, text, text, integer, integer) from public, anon;
revoke execute on function public.compras_estoque_resumo() from public, anon;
grant execute on function public.compras_estoque_listar(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.compras_estoque_resumo() to authenticated;