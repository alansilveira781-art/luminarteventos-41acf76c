
-- 1) Triggers em movimentacoes
DROP TRIGGER IF EXISTS trg_apply_movement ON public.movimentacoes;
CREATE TRIGGER trg_apply_movement
  BEFORE INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

DROP TRIGGER IF EXISTS trg_apply_custo_medio_entrada ON public.movimentacoes;
CREATE TRIGGER trg_apply_custo_medio_entrada
  AFTER INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.apply_custo_medio_entrada();

DROP TRIGGER IF EXISTS trg_refresh_saida_status ON public.movimentacoes;
CREATE TRIGGER trg_refresh_saida_status
  AFTER INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_saida_status();

-- Reverter estoque automaticamente quando uma movimentação é apagada
CREATE OR REPLACE FUNCTION public.revert_movement_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE delta NUMERIC := 0;
BEGIN
  IF OLD.item_id IS NULL THEN RETURN OLD; END IF;
  IF OLD.tipo = 'entrada' THEN delta := -OLD.quantidade;
  ELSIF OLD.tipo = 'saida' THEN delta := OLD.quantidade;
  ELSIF OLD.tipo = 'ajuste' THEN delta := -OLD.quantidade;
  ELSIF OLD.tipo = 'devolucao' THEN
    IF OLD.condicao IN ('perfeito','danificado','quebrado','faltando_peca','em_manutencao') THEN
      delta := -OLD.quantidade;
    END IF;
  END IF;
  IF delta <> 0 THEN
    UPDATE public.itens SET quantidade_atual = quantidade_atual + delta WHERE id = OLD.item_id;
    PERFORM public.refresh_item_status(OLD.item_id);
  END IF;
  RETURN OLD;
END; $fn$;

DROP TRIGGER IF EXISTS trg_revert_movement_on_delete ON public.movimentacoes;
CREATE TRIGGER trg_revert_movement_on_delete
  BEFORE DELETE ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.revert_movement_on_delete();

-- 2) Trigger em movimentacao_itens
DROP TRIGGER IF EXISTS trg_apply_movimentacao_item ON public.movimentacao_itens;
CREATE TRIGGER trg_apply_movimentacao_item
  AFTER INSERT OR UPDATE OR DELETE ON public.movimentacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.apply_movimentacao_item();

-- 3) Alerta de estoque
DROP TRIGGER IF EXISTS trg_notify_stock_alert ON public.itens;
CREATE TRIGGER trg_notify_stock_alert
  AFTER UPDATE OF status ON public.itens
  FOR EACH ROW EXECUTE FUNCTION public.notify_stock_alert();

-- 4) Reconciliação one-shot: recalcula quantidade_atual de cada item
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
    AND m.item_id IS NULL  -- evita dupla contagem quando a movimentação já tem item_id
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

-- Itens sem movimentações: zerar
UPDATE public.itens SET quantidade_atual = 0
WHERE id NOT IN (SELECT item_id FROM public.movimentacoes WHERE item_id IS NOT NULL
                 UNION SELECT item_id FROM public.movimentacao_itens WHERE item_id IS NOT NULL);

-- Recalcular status de todos os itens
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM public.itens LOOP
    PERFORM public.refresh_item_status(r.id);
  END LOOP;
END $$;
