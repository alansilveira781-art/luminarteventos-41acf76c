CREATE OR REPLACE FUNCTION public.estoque_editar_entrada(
  p_old_ids uuid[],
  p_meta jsonb,
  p_linhas jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req integer;
  v_old public.movimentacoes%ROWTYPE;
  v_lin jsonb;
  v_used uuid[] := '{}';
  v_delta numeric;
  v_saldo numeric;
  v_nome text;
  v_qtd numeric;
BEGIN
  IF NOT public.has_module_access(auth.uid(), 'estoque') THEN
    RAISE EXCEPTION 'Sem permissão para editar entradas do estoque' USING ERRCODE = '42501';
  END IF;

  SELECT requisicao_numero INTO v_req
    FROM public.movimentacoes WHERE id = ANY(p_old_ids) LIMIT 1;

  FOR v_lin IN SELECT value FROM jsonb_array_elements(p_linhas) LOOP
    v_qtd := (v_lin->>'quantidade')::numeric;

    SELECT m.* INTO v_old
      FROM public.movimentacoes m
     WHERE m.id = ANY(p_old_ids)
       AND NOT (m.id = ANY(v_used))
       AND m.item_id = (v_lin->>'item_id')::uuid
     ORDER BY m.created_at
     LIMIT 1;

    IF FOUND THEN
      v_used := v_used || v_old.id;
      v_delta := v_qtd - COALESCE(v_old.quantidade, 0);

      IF v_delta <> 0 AND v_old.item_id IS NOT NULL THEN
        SELECT quantidade_atual, nome INTO v_saldo, v_nome
          FROM public.itens WHERE id = v_old.item_id;
        IF v_saldo IS NOT NULL AND v_saldo + v_delta < 0 THEN
          RAISE EXCEPTION
            'Não é possível alterar a quantidade de "%": o saldo em estoque ficaria negativo (saldo atual %, redução de %).',
            v_nome, v_saldo, abs(v_delta)
            USING ERRCODE = 'check_violation';
        END IF;
        UPDATE public.itens
           SET quantidade_atual = quantidade_atual + v_delta
         WHERE id = v_old.item_id;
        PERFORM public.refresh_item_status(v_old.item_id);
      END IF;

      UPDATE public.movimentacoes SET
        data_movimento = COALESCE(NULLIF(p_meta->>'data_movimento','')::timestamptz, data_movimento),
        entrada_tipo   = COALESCE(NULLIF(p_meta->>'entrada_tipo','')::entrada_tipo, entrada_tipo),
        fornecedor_id  = NULLIF(p_meta->>'fornecedor_id','')::uuid,
        empresa        = NULLIF(p_meta->>'empresa',''),
        nota_fiscal    = NULLIF(p_meta->>'nota_fiscal',''),
        observacoes    = NULLIF(p_meta->>'observacoes',''),
        quantidade     = v_qtd,
        valor_unitario = NULLIF(v_lin->>'valor_unitario','')::numeric,
        valor_total    = NULLIF(v_lin->>'valor_total','')::numeric,
        desconto       = NULLIF(v_lin->>'desconto','')::numeric,
        frete          = NULLIF(v_lin->>'frete','')::numeric,
        ipi            = NULLIF(v_lin->>'ipi','')::numeric,
        outros_custos  = NULLIF(v_lin->>'outros_custos','')::numeric
      WHERE id = v_old.id;
    ELSE
      INSERT INTO public.movimentacoes (
        tipo, data_movimento, entrada_tipo, fornecedor_id, empresa, nota_fiscal, observacoes,
        item_id, quantidade, valor_unitario, valor_total, desconto, frete, ipi, outros_custos,
        requisicao_numero, responsavel_lancamento, evento_projeto
      ) VALUES (
        'entrada',
        COALESCE(NULLIF(p_meta->>'data_movimento','')::timestamptz, now()),
        NULLIF(p_meta->>'entrada_tipo','')::entrada_tipo,
        NULLIF(p_meta->>'fornecedor_id','')::uuid,
        NULLIF(p_meta->>'empresa',''),
        NULLIF(p_meta->>'nota_fiscal',''),
        NULLIF(p_meta->>'observacoes',''),
        (v_lin->>'item_id')::uuid,
        v_qtd,
        NULLIF(v_lin->>'valor_unitario','')::numeric,
        NULLIF(v_lin->>'valor_total','')::numeric,
        NULLIF(v_lin->>'desconto','')::numeric,
        NULLIF(v_lin->>'frete','')::numeric,
        NULLIF(v_lin->>'ipi','')::numeric,
        NULLIF(v_lin->>'outros_custos','')::numeric,
        v_req,
        NULLIF(p_meta->>'responsavel_lancamento',''),
        NULLIF(p_meta->>'evento_projeto','')
      );
    END IF;
  END LOOP;

  DELETE FROM public.movimentacoes
   WHERE id = ANY(p_old_ids) AND NOT (id = ANY(v_used));
END;
$$;

REVOKE ALL ON FUNCTION public.estoque_editar_entrada(uuid[], jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estoque_editar_entrada(uuid[], jsonb, jsonb) TO authenticated;