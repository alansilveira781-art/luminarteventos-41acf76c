
ALTER TYPE saida_tipo ADD VALUE IF NOT EXISTS 'epi_fardamento';

ALTER TABLE public.movimentacoes ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE public.movimentacoes ALTER COLUMN quantidade DROP NOT NULL;

ALTER TABLE public.movimentacao_itens
  DROP CONSTRAINT IF EXISTS movimentacao_itens_movimentacao_id_fkey;
ALTER TABLE public.movimentacao_itens
  ADD CONSTRAINT movimentacao_itens_movimentacao_id_fkey
  FOREIGN KEY (movimentacao_id) REFERENCES public.movimentacoes(id) ON DELETE CASCADE;

ALTER TABLE public.movimentacao_itens
  DROP CONSTRAINT IF EXISTS movimentacao_itens_item_id_fkey;
ALTER TABLE public.movimentacao_itens
  ADD CONSTRAINT movimentacao_itens_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.itens(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.apply_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  IF NEW.tipo = 'devolucao' AND NEW.condicao IN ('danificado','quebrado','faltando_peca','em_manutencao') THEN
    UPDATE public.itens SET status='em_manutencao' WHERE id=NEW.item_id;
  END IF;

  RETURN NEW;
END; $function$;

INSERT INTO public.movimentacao_itens (movimentacao_id, item_id, quantidade, valor_unitario)
SELECT m.id, m.item_id, m.quantidade, m.valor_unitario
FROM public.movimentacoes m
WHERE m.tipo IN ('entrada','saida')
  AND m.item_id IS NOT NULL
  AND m.quantidade IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.movimentacao_itens mi WHERE mi.movimentacao_id = m.id
  );

CREATE OR REPLACE FUNCTION public.apply_movimentacao_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    IF v_tipo = 'devolucao' AND v_condicao IN ('danificado','quebrado','faltando_peca','em_manutencao') THEN
      UPDATE public.itens SET status='em_manutencao' WHERE id=NEW.item_id;
    END IF;
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
END; $function$;

DROP TRIGGER IF EXISTS trg_apply_movimentacao_item ON public.movimentacao_itens;
CREATE TRIGGER trg_apply_movimentacao_item
AFTER INSERT OR UPDATE OR DELETE ON public.movimentacao_itens
FOR EACH ROW EXECUTE FUNCTION public.apply_movimentacao_item();

CREATE OR REPLACE FUNCTION public.refresh_saida_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE total_devolvido NUMERIC; qtd_saida NUMERIC; v_origem UUID;
BEGIN
  v_origem := NEW.saida_origem_id;
  IF v_origem IS NULL OR NEW.tipo <> 'devolucao' THEN RETURN NEW; END IF;

  SELECT COALESCE(
    (SELECT quantidade FROM public.movimentacoes WHERE id = v_origem),
    (SELECT COALESCE(SUM(quantidade),0) FROM public.movimentacao_itens WHERE movimentacao_id = v_origem)
  ) INTO qtd_saida;

  SELECT COALESCE(SUM(quantidade),0) INTO total_devolvido
    FROM public.movimentacoes
    WHERE saida_origem_id = v_origem AND tipo='devolucao';

  IF total_devolvido >= qtd_saida THEN
    UPDATE public.movimentacoes SET saida_status='devolvida' WHERE id=v_origem;
  ELSE
    UPDATE public.movimentacoes SET saida_status='parcialmente_devolvida' WHERE id=v_origem;
  END IF;

  RETURN NEW;
END; $function$;
