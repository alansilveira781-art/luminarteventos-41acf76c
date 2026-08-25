-- ============ TOMADORES ============
CREATE TABLE public.pat_tomadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'PJ' CHECK (tipo IN ('PF','PJ')),
  nome text NOT NULL,
  documento text,
  endereco text,
  contato_nome text,
  contato_telefone text,
  email text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pat_tomadores TO authenticated;
GRANT ALL ON public.pat_tomadores TO service_role;
ALTER TABLE public.pat_tomadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrimonio module access" ON public.pat_tomadores FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio'))
  WITH CHECK (public.has_module_access(auth.uid(), 'patrimonio'));
CREATE TRIGGER pat_tomadores_updated_at BEFORE UPDATE ON public.pat_tomadores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ O.S. ============
CREATE SEQUENCE public.pat_os_numero_seq;

CREATE TABLE public.pat_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.pat_os_numero_seq'),
  tipo text NOT NULL CHECK (tipo IN ('evento','emprestimo')),
  evento_projeto text,
  tomador_id uuid REFERENCES public.pat_tomadores(id) ON DELETE SET NULL,
  retirante_nome text,
  retirante_cpf text,
  data_saida date NOT NULL DEFAULT CURRENT_DATE,
  previsao_retorno date,
  responsavel text,
  observacoes text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','parcial','concluida')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pat_os_numero_key ON public.pat_os(numero);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pat_os TO authenticated;
GRANT ALL ON public.pat_os TO service_role;
ALTER TABLE public.pat_os ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pat_os select" ON public.pat_os FOR SELECT TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio'));
CREATE POLICY "pat_os insert" ON public.pat_os FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access(auth.uid(), 'patrimonio'));
CREATE POLICY "pat_os update" ON public.pat_os FOR UPDATE TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio'))
  WITH CHECK (public.has_module_access(auth.uid(), 'patrimonio'));
CREATE POLICY "pat_os delete" ON public.pat_os FOR DELETE TO authenticated
  USING (public.is_module_admin(auth.uid(), 'patrimonio'));
CREATE TRIGGER pat_os_updated_at BEFORE UPDATE ON public.pat_os
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pat_os_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.pat_os(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.pat_itens(id) ON DELETE SET NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  quantidade_devolvida numeric NOT NULL DEFAULT 0,
  quantidade_perdida numeric NOT NULL DEFAULT 0,
  mov_id uuid REFERENCES public.pat_movimentacoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pat_os_itens_os_id_idx ON public.pat_os_itens(os_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pat_os_itens TO authenticated;
GRANT ALL ON public.pat_os_itens TO service_role;
ALTER TABLE public.pat_os_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrimonio module access" ON public.pat_os_itens FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio'))
  WITH CHECK (public.has_module_access(auth.uid(), 'patrimonio'));
CREATE TRIGGER pat_os_itens_updated_at BEFORE UPDATE ON public.pat_os_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pat_os_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.pat_os(id) ON DELETE CASCADE,
  data_devolucao date NOT NULL DEFAULT CURRENT_DATE,
  responsavel text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pat_os_devolucoes_os_id_idx ON public.pat_os_devolucoes(os_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pat_os_devolucoes TO authenticated;
GRANT ALL ON public.pat_os_devolucoes TO service_role;
ALTER TABLE public.pat_os_devolucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrimonio module access" ON public.pat_os_devolucoes FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio'))
  WITH CHECK (public.has_module_access(auth.uid(), 'patrimonio'));

CREATE TABLE public.pat_os_devolucao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id uuid NOT NULL REFERENCES public.pat_os_devolucoes(id) ON DELETE CASCADE,
  os_item_id uuid NOT NULL REFERENCES public.pat_os_itens(id) ON DELETE CASCADE,
  quantidade_devolvida numeric NOT NULL DEFAULT 0,
  quantidade_faltante numeric NOT NULL DEFAULT 0,
  motivo text CHECK (motivo IN ('emprestimo','perda')),
  justificativa text,
  condicao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pat_os_devolucao_itens_dev_idx ON public.pat_os_devolucao_itens(devolucao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pat_os_devolucao_itens TO authenticated;
GRANT ALL ON public.pat_os_devolucao_itens TO service_role;
ALTER TABLE public.pat_os_devolucao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrimonio module access" ON public.pat_os_devolucao_itens FOR ALL TO authenticated
  USING (public.has_module_access(auth.uid(), 'patrimonio'))
  WITH CHECK (public.has_module_access(auth.uid(), 'patrimonio'));

ALTER TABLE public.pat_movimentacoes ADD COLUMN os_id uuid REFERENCES public.pat_os(id) ON DELETE SET NULL;

-- ============ RPC: criar O.S. ============
CREATE OR REPLACE FUNCTION public.pat_os_criar(p_meta jsonb, p_linhas jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_id uuid;
  v_uid uuid := auth.uid();
  v_linha jsonb;
  v_mov_id uuid;
  v_destino text;
BEGIN
  IF NOT public.has_module_access(v_uid, 'patrimonio') THEN
    RAISE EXCEPTION 'Sem permissão no módulo Patrimônio';
  END IF;

  INSERT INTO public.pat_os (
    tipo, evento_projeto, tomador_id, retirante_nome, retirante_cpf,
    data_saida, previsao_retorno, responsavel, observacoes, created_by
  ) VALUES (
    p_meta->>'tipo',
    NULLIF(p_meta->>'evento_projeto',''),
    NULLIF(p_meta->>'tomador_id','')::uuid,
    NULLIF(p_meta->>'retirante_nome',''),
    NULLIF(p_meta->>'retirante_cpf',''),
    COALESCE(NULLIF(p_meta->>'data_saida','')::date, CURRENT_DATE),
    NULLIF(p_meta->>'previsao_retorno','')::date,
    NULLIF(p_meta->>'responsavel',''),
    NULLIF(p_meta->>'observacoes',''),
    v_uid
  ) RETURNING id INTO v_os_id;

  SELECT CASE WHEN p_meta->>'tipo' = 'evento'
              THEN COALESCE(NULLIF(p_meta->>'evento_projeto',''), 'Evento')
              ELSE 'Empréstimo' END INTO v_destino;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    INSERT INTO public.pat_movimentacoes (
      tipo, item_id, quantidade, data_movimento, responsavel, evento_projeto,
      finalidade, observacoes, data_prevista_devolucao, saida_status, created_by, os_id
    ) VALUES (
      'saida',
      (v_linha->>'item_id')::uuid,
      COALESCE((v_linha->>'quantidade')::numeric, 1),
      COALESCE(NULLIF(p_meta->>'data_saida','')::date, CURRENT_DATE),
      NULLIF(p_meta->>'responsavel',''),
      NULLIF(p_meta->>'evento_projeto',''),
      CASE WHEN p_meta->>'tipo' = 'evento' THEN 'Evento' ELSE 'Empréstimo' END,
      NULLIF(p_meta->>'observacoes',''),
      NULLIF(p_meta->>'previsao_retorno','')::date,
      'aberta',
      v_uid,
      v_os_id
    ) RETURNING id INTO v_mov_id;

    INSERT INTO public.pat_os_itens (os_id, item_id, quantidade, mov_id)
    VALUES (v_os_id, (v_linha->>'item_id')::uuid, COALESCE((v_linha->>'quantidade')::numeric, 1), v_mov_id);
  END LOOP;

  RETURN v_os_id;
END;
$$;

-- ============ RPC: registrar devolução ============
CREATE OR REPLACE FUNCTION public.pat_os_registrar_devolucao(
  p_os_id uuid, p_data date, p_responsavel text, p_observacoes text, p_linhas jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dev_id uuid;
  v_linha jsonb;
  v_os_item public.pat_os_itens%ROWTYPE;
  v_qtd numeric;
  v_falta numeric;
  v_motivo text;
  v_pendente numeric;
BEGIN
  IF NOT public.has_module_access(v_uid, 'patrimonio') THEN
    RAISE EXCEPTION 'Sem permissão no módulo Patrimônio';
  END IF;

  INSERT INTO public.pat_os_devolucoes (os_id, data_devolucao, responsavel, observacoes, created_by)
  VALUES (p_os_id, COALESCE(p_data, CURRENT_DATE), NULLIF(p_responsavel,''), NULLIF(p_observacoes,''), v_uid)
  RETURNING id INTO v_dev_id;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    SELECT * INTO v_os_item FROM public.pat_os_itens WHERE id = (v_linha->>'os_item_id')::uuid AND os_id = p_os_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item da O.S. não encontrado';
    END IF;

    v_qtd := COALESCE((v_linha->>'quantidade_devolvida')::numeric, 0);
    v_falta := COALESCE((v_linha->>'quantidade_faltante')::numeric, 0);
    v_motivo := NULLIF(v_linha->>'motivo','');

    IF v_qtd = 0 AND v_falta = 0 THEN
      CONTINUE;
    END IF;

    v_pendente := v_os_item.quantidade - v_os_item.quantidade_devolvida - v_os_item.quantidade_perdida;
    IF v_qtd + v_falta > v_pendente THEN
      RAISE EXCEPTION 'Quantidade maior que o pendente na O.S.';
    END IF;

    INSERT INTO public.pat_os_devolucao_itens (
      devolucao_id, os_item_id, quantidade_devolvida, quantidade_faltante, motivo, justificativa, condicao
    ) VALUES (
      v_dev_id, v_os_item.id, v_qtd, v_falta, v_motivo,
      NULLIF(v_linha->>'justificativa',''), NULLIF(v_linha->>'condicao','')
    );

    IF v_qtd > 0 THEN
      INSERT INTO public.pat_movimentacoes (
        tipo, item_id, quantidade, data_movimento, responsavel, observacoes,
        condicao, saida_origem_id, created_by, os_id
      ) VALUES (
        'devolucao', v_os_item.item_id, v_qtd, COALESCE(p_data, CURRENT_DATE),
        NULLIF(p_responsavel,''), NULLIF(p_observacoes,''),
        NULLIF(v_linha->>'condicao',''), v_os_item.mov_id, v_uid, p_os_id
      );
      UPDATE public.pat_os_itens SET quantidade_devolvida = quantidade_devolvida + v_qtd WHERE id = v_os_item.id;
    END IF;

    IF v_falta > 0 AND v_motivo = 'perda' THEN
      INSERT INTO public.pat_movimentacoes (
        tipo, item_id, quantidade, data_movimento, responsavel, finalidade, observacoes,
        saida_origem_id, created_by, os_id
      ) VALUES (
        'perda', v_os_item.item_id, v_falta, COALESCE(p_data, CURRENT_DATE),
        NULLIF(p_responsavel,''), 'Perda',
        NULLIF(v_linha->>'justificativa',''), v_os_item.mov_id, v_uid, p_os_id
      );
      UPDATE public.pat_os_itens SET quantidade_perdida = quantidade_perdida + v_falta WHERE id = v_os_item.id;
      UPDATE public.pat_itens
        SET quantidade = GREATEST(0, quantidade - v_falta),
            estado = CASE WHEN GREATEST(0, quantidade - v_falta) = 0 THEN 'PERDIDO' ELSE estado END
        WHERE id = v_os_item.item_id;
    END IF;
  END LOOP;

  -- fecha movimentações totalmente resolvidas
  UPDATE public.pat_movimentacoes m
    SET saida_status = CASE
      WHEN oi.quantidade_devolvida + oi.quantidade_perdida >= oi.quantidade THEN 'devolvida'
      WHEN oi.quantidade_devolvida + oi.quantidade_perdida > 0 THEN 'parcialmente_devolvida'
      ELSE 'aberta' END
    FROM public.pat_os_itens oi
    WHERE oi.os_id = p_os_id AND m.id = oi.mov_id;

  -- atualiza status da O.S.
  UPDATE public.pat_os o SET status = sub.novo_status
  FROM (
    SELECT CASE
      WHEN SUM(quantidade_devolvida + quantidade_perdida) >= SUM(quantidade) THEN 'concluida'
      WHEN SUM(quantidade_devolvida + quantidade_perdida) > 0 THEN 'parcial'
      ELSE 'aberta' END AS novo_status
    FROM public.pat_os_itens WHERE os_id = p_os_id
  ) sub
  WHERE o.id = p_os_id;

  RETURN v_dev_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pat_os_criar(jsonb, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.pat_os_registrar_devolucao(uuid, date, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.pat_os_criar(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pat_os_registrar_devolucao(uuid, date, text, text, jsonb) TO authenticated;