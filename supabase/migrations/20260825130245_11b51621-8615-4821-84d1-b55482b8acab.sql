ALTER TABLE public.rh_colaboradores ADD COLUMN IF NOT EXISTS data_nascimento date;

CREATE TABLE public.rh_colaborador_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'outros',
  descricao text,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  validade date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_colaborador_documentos TO authenticated;
GRANT ALL ON public.rh_colaborador_documentos TO service_role;

ALTER TABLE public.rh_colaborador_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_doc_select" ON public.rh_colaborador_documentos
  FOR SELECT TO authenticated USING (public.has_module_access(auth.uid(), 'rh'));
CREATE POLICY "rh_doc_insert" ON public.rh_colaborador_documentos
  FOR INSERT TO authenticated WITH CHECK (public.has_module_access(auth.uid(), 'rh') AND created_by = auth.uid());
CREATE POLICY "rh_doc_update" ON public.rh_colaborador_documentos
  FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'rh'))
  WITH CHECK (public.has_module_access(auth.uid(), 'rh'));
CREATE POLICY "rh_doc_delete" ON public.rh_colaborador_documentos
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'rh'));

CREATE INDEX idx_rh_colab_doc_colaborador ON public.rh_colaborador_documentos(colaborador_id);

CREATE TRIGGER rh_colaborador_documentos_updated_at
  BEFORE UPDATE ON public.rh_colaborador_documentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "rh_documentos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rh-documentos' AND public.has_module_access(auth.uid(), 'rh'));
CREATE POLICY "rh_documentos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rh-documentos' AND public.has_module_access(auth.uid(), 'rh'));
CREATE POLICY "rh_documentos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rh-documentos' AND (public.is_admin(auth.uid()) OR public.is_module_admin(auth.uid(), 'rh')));

CREATE OR REPLACE FUNCTION public.pat_os_editar(p_os_id uuid, p_meta jsonb, p_linhas jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_linha jsonb;
  v_os_item public.pat_os_itens%ROWTYPE;
  v_qtd numeric;
  v_mov_id uuid;
  v_new_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF NOT public.has_module_access(v_uid, 'patrimonio') THEN
    RAISE EXCEPTION 'Sem permissão no módulo Patrimônio';
  END IF;

  UPDATE public.pat_os SET
    tipo = COALESCE(NULLIF(p_meta->>'tipo',''), tipo),
    evento_projeto = NULLIF(p_meta->>'evento_projeto',''),
    tomador_id = NULLIF(p_meta->>'tomador_id','')::uuid,
    retirante_nome = NULLIF(p_meta->>'retirante_nome',''),
    retirante_cpf = NULLIF(p_meta->>'retirante_cpf',''),
    data_saida = COALESCE(NULLIF(p_meta->>'data_saida','')::date, data_saida),
    previsao_retorno = NULLIF(p_meta->>'previsao_retorno','')::date,
    responsavel = NULLIF(p_meta->>'responsavel',''),
    observacoes = NULLIF(p_meta->>'observacoes','')
  WHERE id = p_os_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O.S. não encontrada';
  END IF;

  IF p_linhas IS NOT NULL AND jsonb_typeof(p_linhas) = 'array' THEN
    FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
      v_qtd := COALESCE((v_linha->>'quantidade')::numeric, 0);

      IF NULLIF(v_linha->>'os_item_id','') IS NOT NULL THEN
        SELECT * INTO v_os_item FROM public.pat_os_itens
          WHERE id = (v_linha->>'os_item_id')::uuid AND os_id = p_os_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item da O.S. não encontrado';
        END IF;
        IF v_qtd < v_os_item.quantidade_devolvida + v_os_item.quantidade_perdida THEN
          RAISE EXCEPTION 'Quantidade menor que o já devolvido/perdido';
        END IF;
        UPDATE public.pat_os_itens SET quantidade = v_qtd WHERE id = v_os_item.id;
        UPDATE public.pat_movimentacoes SET
          quantidade = v_qtd,
          data_movimento = COALESCE(NULLIF(p_meta->>'data_saida','')::date, data_movimento),
          responsavel = NULLIF(p_meta->>'responsavel',''),
          evento_projeto = NULLIF(p_meta->>'evento_projeto',''),
          data_prevista_devolucao = NULLIF(p_meta->>'previsao_retorno','')::date
          WHERE id = v_os_item.mov_id;
        v_ids := array_append(v_ids, v_os_item.id);
      ELSE
        INSERT INTO public.pat_movimentacoes (
          tipo, item_id, quantidade, data_movimento, responsavel, evento_projeto,
          finalidade, observacoes, data_prevista_devolucao, saida_status, created_by, os_id
        ) VALUES (
          'saida',
          (v_linha->>'item_id')::uuid,
          v_qtd,
          COALESCE(NULLIF(p_meta->>'data_saida','')::date, CURRENT_DATE),
          NULLIF(p_meta->>'responsavel',''),
          NULLIF(p_meta->>'evento_projeto',''),
          CASE WHEN p_meta->>'tipo' = 'evento' THEN 'Evento' ELSE 'Empréstimo' END,
          NULLIF(p_meta->>'observacoes',''),
          NULLIF(p_meta->>'previsao_retorno','')::date,
          'aberta',
          v_uid,
          p_os_id
        ) RETURNING id INTO v_mov_id;
        INSERT INTO public.pat_os_itens (os_id, item_id, quantidade, mov_id)
        VALUES (p_os_id, (v_linha->>'item_id')::uuid, v_qtd, v_mov_id)
        RETURNING id INTO v_new_id;
        v_ids := array_append(v_ids, v_new_id);
      END IF;
    END LOOP;

    DELETE FROM public.pat_movimentacoes m
      USING public.pat_os_itens oi
      WHERE oi.os_id = p_os_id
        AND NOT (oi.id = ANY(v_ids))
        AND oi.quantidade_devolvida = 0 AND oi.quantidade_perdida = 0
        AND m.id = oi.mov_id;

    DELETE FROM public.pat_os_itens oi
      WHERE oi.os_id = p_os_id
        AND NOT (oi.id = ANY(v_ids))
        AND oi.quantidade_devolvida = 0 AND oi.quantidade_perdida = 0;
  END IF;

  UPDATE public.pat_os o SET status = sub.novo_status
  FROM (
    SELECT CASE
      WHEN SUM(quantidade_devolvida + quantidade_perdida) >= SUM(quantidade) THEN 'concluida'
      WHEN SUM(quantidade_devolvida + quantidade_perdida) > 0 THEN 'parcial'
      ELSE 'aberta' END AS novo_status
    FROM public.pat_os_itens WHERE os_id = p_os_id
  ) sub
  WHERE o.id = p_os_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pat_os_excluir(p_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_module_admin(v_uid, 'patrimonio') AND NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Somente administradores do módulo Patrimônio podem excluir uma O.S.';
  END IF;

  DELETE FROM public.pat_movimentacoes WHERE os_id = p_os_id;
  DELETE FROM public.pat_os_devolucao_itens di
    USING public.pat_os_devolucoes d
    WHERE d.os_id = p_os_id AND di.devolucao_id = d.id;
  DELETE FROM public.pat_os_devolucoes WHERE os_id = p_os_id;
  DELETE FROM public.pat_os_itens WHERE os_id = p_os_id;
  DELETE FROM public.pat_os WHERE id = p_os_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.pat_os_editar(uuid, jsonb, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.pat_os_excluir(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pat_os_editar(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pat_os_excluir(uuid) TO authenticated;