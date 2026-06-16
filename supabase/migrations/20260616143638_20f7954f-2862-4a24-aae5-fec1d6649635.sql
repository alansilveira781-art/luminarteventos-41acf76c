
-- Correção 1: reconciliar_estoque sem dupla contagem
CREATE OR REPLACE FUNCTION public.reconciliar_estoque(p_item_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN tipo = 'entrada' THEN quantidade
      WHEN tipo = 'saida'   THEN -quantidade
      WHEN tipo = 'ajuste'  THEN quantidade
      WHEN tipo = 'devolucao' AND condicao IN ('perfeito','danificado','quebrado','faltando_peca','em_manutencao')
        THEN quantidade
      ELSE 0
    END
  ), 0)
  INTO v_total
  FROM public.movimentacoes
  WHERE item_id = p_item_id;

  SELECT v_total + COALESCE(SUM(
    CASE
      WHEN m.tipo = 'entrada' THEN mi.quantidade
      WHEN m.tipo = 'saida'   THEN -mi.quantidade
      WHEN m.tipo = 'ajuste'  THEN mi.quantidade
      WHEN m.tipo = 'devolucao' AND m.condicao IN ('perfeito','danificado','quebrado','faltando_peca','em_manutencao')
        THEN mi.quantidade
      ELSE 0
    END
  ), 0)
  INTO v_total
  FROM public.movimentacao_itens mi
  JOIN public.movimentacoes m ON m.id = mi.movimentacao_id
  WHERE mi.item_id = p_item_id
    AND m.item_id IS NULL;

  UPDATE public.itens
     SET quantidade_atual = v_total
   WHERE id = p_item_id;

  PERFORM public.refresh_item_status(p_item_id);

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconciliar_estoque(uuid) TO authenticated;

-- Correção 3a: refresh_item_status não trava em "em_manutencao"
CREATE OR REPLACE FUNCTION public.refresh_item_status(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE q NUMERIC; m NUMERIC; s item_status;
BEGIN
  SELECT quantidade_atual, quantidade_minima, status INTO q, m, s
    FROM public.itens WHERE id = p_item_id;

  IF s = 'inativo' THEN RETURN; END IF;

  IF q <= 0 THEN
    UPDATE public.itens SET status='sem_estoque' WHERE id=p_item_id;
  ELSIF q <= m THEN
    UPDATE public.itens SET status='baixo_estoque' WHERE id=p_item_id;
  ELSE
    UPDATE public.itens SET status='disponivel' WHERE id=p_item_id;
  END IF;
END; $$;

-- Correção 3b: apply_movement sem forçar em_manutencao
CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE delta NUMERIC := 0;
BEGIN
  IF NEW.item_id IS NULL THEN
    IF NEW.tipo = 'saida' AND NEW.saida_status IS NULL THEN NEW.saida_status := 'aberta'; END IF;
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'entrada' THEN
    delta := NEW.quantidade;
  ELSIF NEW.tipo = 'saida' THEN
    delta := -NEW.quantidade;
    IF NEW.saida_status IS NULL THEN NEW.saida_status := 'aberta'; END IF;
  ELSIF NEW.tipo = 'devolucao' THEN
    IF NEW.condicao IN ('perfeito') THEN
      delta := NEW.quantidade;
    ELSIF NEW.condicao IN ('danificado','quebrado','faltando_peca','em_manutencao') THEN
      delta := NEW.quantidade;
    ELSE
      delta := 0;
    END IF;
  ELSIF NEW.tipo = 'ajuste' THEN
    delta := NEW.quantidade;
  END IF;

  UPDATE public.itens
    SET quantidade_atual = quantidade_atual + delta
    WHERE id = NEW.item_id;

  PERFORM public.refresh_item_status(NEW.item_id);

  RETURN NEW;
END; $$;

-- Correção 3c: apply_movimentacao_item sem forçar em_manutencao
CREATE OR REPLACE FUNCTION public.apply_movimentacao_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo movement_kind;
  v_condicao devolucao_condicao;
  v_old_delta NUMERIC := 0;
  v_new_delta NUMERIC := 0;
  v_parent_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_parent_id := OLD.movimentacao_id;
  ELSE
    v_parent_id := NEW.movimentacao_id;
  END IF;

  SELECT tipo, condicao INTO v_tipo, v_condicao
    FROM public.movimentacoes WHERE id = v_parent_id;

  IF v_tipo IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_new_delta := CASE
      WHEN v_tipo = 'entrada' THEN NEW.quantidade
      WHEN v_tipo = 'saida' THEN -NEW.quantidade
      WHEN v_tipo = 'ajuste' THEN NEW.quantidade
      WHEN v_tipo = 'devolucao' THEN
        CASE WHEN v_condicao IN ('perfeito','danificado','quebrado','faltando_peca','em_manutencao')
             THEN NEW.quantidade ELSE 0 END
      ELSE 0
    END;
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') THEN
    v_old_delta := CASE
      WHEN v_tipo = 'entrada' THEN OLD.quantidade
      WHEN v_tipo = 'saida' THEN -OLD.quantidade
      WHEN v_tipo = 'ajuste' THEN OLD.quantidade
      WHEN v_tipo = 'devolucao' THEN
        CASE WHEN v_condicao IN ('perfeito','danificado','quebrado','faltando_peca','em_manutencao')
             THEN OLD.quantidade ELSE 0 END
      ELSE 0
    END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.itens SET quantidade_atual = quantidade_atual + v_new_delta WHERE id = NEW.item_id;
    PERFORM public.refresh_item_status(NEW.item_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.itens SET quantidade_atual = quantidade_atual - v_old_delta WHERE id = OLD.item_id;
    PERFORM public.refresh_item_status(OLD.item_id);
    RETURN OLD;
  ELSE
    UPDATE public.itens SET quantidade_atual = quantidade_atual - v_old_delta WHERE id = OLD.item_id;
    UPDATE public.itens SET quantidade_atual = quantidade_atual + v_new_delta WHERE id = NEW.item_id;
    PERFORM public.refresh_item_status(OLD.item_id);
    IF NEW.item_id <> OLD.item_id THEN PERFORM public.refresh_item_status(NEW.item_id); END IF;
    RETURN NEW;
  END IF;
END; $$;

-- Correção 4: refresh_saida_status distingue retornado de perdido
CREATE OR REPLACE FUNCTION public.refresh_saida_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  total_retornado NUMERIC;
  total_perdido NUMERIC;
  qtd_saida NUMERIC;
  v_origem UUID;
BEGIN
  v_origem := NEW.saida_origem_id;
  IF v_origem IS NULL OR NEW.tipo <> 'devolucao' THEN RETURN NEW; END IF;

  SELECT COALESCE(
    (SELECT quantidade FROM public.movimentacoes WHERE id = v_origem),
    (SELECT COALESCE(SUM(quantidade),0) FROM public.movimentacao_itens WHERE movimentacao_id = v_origem)
  ) INTO qtd_saida;

  SELECT COALESCE(SUM(quantidade),0) INTO total_retornado
    FROM public.movimentacoes
    WHERE saida_origem_id = v_origem
      AND tipo='devolucao'
      AND condicao <> 'perdido';

  SELECT COALESCE(SUM(quantidade),0) INTO total_perdido
    FROM public.movimentacoes
    WHERE saida_origem_id = v_origem
      AND tipo='devolucao'
      AND condicao = 'perdido';

  IF (total_retornado + total_perdido) >= qtd_saida THEN
    UPDATE public.movimentacoes SET saida_status='devolvida' WHERE id=v_origem;
  ELSIF total_retornado > 0 OR total_perdido > 0 THEN
    UPDATE public.movimentacoes SET saida_status='parcialmente_devolvida' WHERE id=v_origem;
  END IF;

  RETURN NEW;
END; $$;

-- Correção 2: reconciliar todos os saldos agora
WITH movs AS (
  SELECT item_id,
    SUM(CASE
      WHEN tipo='entrada' THEN quantidade
      WHEN tipo='saida' THEN -quantidade
      WHEN tipo='ajuste' THEN quantidade
      WHEN tipo='devolucao' AND condicao IN ('perfeito','danificado','quebrado','faltando_peca','em_manutencao') THEN quantidade
      ELSE 0 END) AS total
  FROM public.movimentacoes
  WHERE item_id IS NOT NULL
  GROUP BY item_id
),
mi AS (
  SELECT mi.item_id,
    SUM(CASE
      WHEN m.tipo='entrada' THEN mi.quantidade
      WHEN m.tipo='saida' THEN -mi.quantidade
      WHEN m.tipo='ajuste' THEN mi.quantidade
      WHEN m.tipo='devolucao' AND m.condicao IN ('perfeito','danificado','quebrado','faltando_peca','em_manutencao') THEN mi.quantidade
      ELSE 0 END) AS total
  FROM public.movimentacao_itens mi
  JOIN public.movimentacoes m ON m.id = mi.movimentacao_id
  WHERE mi.item_id IS NOT NULL
    AND m.item_id IS NULL
  GROUP BY mi.item_id
),
totais AS (
  SELECT item_id, SUM(total) AS total FROM (
    SELECT * FROM movs UNION ALL SELECT * FROM mi
  ) t GROUP BY item_id
)
UPDATE public.itens i
SET quantidade_atual = COALESCE(t.total, 0)
FROM totais t
WHERE t.item_id = i.id;

UPDATE public.itens SET quantidade_atual = 0
WHERE id NOT IN (
  SELECT item_id FROM public.movimentacoes WHERE item_id IS NOT NULL
  UNION
  SELECT item_id FROM public.movimentacao_itens WHERE item_id IS NOT NULL
);

-- Refresh status de todos os itens após reconciliação
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.itens LOOP
    PERFORM public.refresh_item_status(r.id);
  END LOOP;
END $$;

-- Correção 5: garantir triggers ativos
DROP TRIGGER IF EXISTS trg_apply_movement ON public.movimentacoes;
CREATE TRIGGER trg_apply_movement
  BEFORE INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

DROP TRIGGER IF EXISTS trg_refresh_saida_status ON public.movimentacoes;
CREATE TRIGGER trg_refresh_saida_status
  AFTER INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_saida_status();

DROP TRIGGER IF EXISTS trg_apply_movimentacao_item ON public.movimentacao_itens;
CREATE TRIGGER trg_apply_movimentacao_item
  AFTER INSERT OR UPDATE OR DELETE ON public.movimentacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.apply_movimentacao_item();

DROP TRIGGER IF EXISTS trg_revert_movement_on_delete ON public.movimentacoes;
CREATE TRIGGER trg_revert_movement_on_delete
  BEFORE DELETE ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.revert_movement_on_delete();
