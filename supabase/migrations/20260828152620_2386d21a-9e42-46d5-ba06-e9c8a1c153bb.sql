CREATE OR REPLACE FUNCTION public.estoque_excluir_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qtd numeric;
BEGIN
  IF NOT public.is_module_admin(auth.uid(), 'estoque') THEN
    RAISE EXCEPTION 'Sem permissão para excluir itens do estoque';
  END IF;

  SELECT quantidade_atual INTO v_qtd FROM public.itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF COALESCE(v_qtd, 0) > 0 THEN
    INSERT INTO public.movimentacoes (tipo, item_id, quantidade, saida_tipo, finalidade, observacoes, responsavel_lancamento)
    VALUES ('saida', p_item_id, v_qtd, 'outros', 'Baixa por exclusão de item', 'Saída automática gerada na exclusão do item', 'Sistema');
  END IF;

  UPDATE public.estoque_solicitacoes_saida_itens SET item_id = NULL WHERE item_id = p_item_id;
  UPDATE public.demanda_itens SET item_id = NULL WHERE item_id = p_item_id;

  DELETE FROM public.movimentacao_itens WHERE item_id = p_item_id;
  DELETE FROM public.movimentacoes WHERE item_id = p_item_id;
  DELETE FROM public.itens WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.estoque_excluir_item(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.estoque_excluir_item(uuid) TO authenticated;