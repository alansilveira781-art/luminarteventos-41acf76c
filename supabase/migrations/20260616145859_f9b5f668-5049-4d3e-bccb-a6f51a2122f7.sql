
-- 0) Clamp de saldos já negativos para 0 (não há estoque negativo no negócio)
UPDATE public.itens SET quantidade_atual = 0 WHERE quantidade_atual < 0;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.itens LOOP
    PERFORM public.refresh_item_status(r.id);
  END LOOP;
END $$;

-- 1) CHECK constraint: saldo nunca negativo
ALTER TABLE public.itens
  DROP CONSTRAINT IF EXISTS chk_itens_quantidade_nao_negativa;
ALTER TABLE public.itens
  ADD CONSTRAINT chk_itens_quantidade_nao_negativa
  CHECK (quantidade_atual >= 0);

-- 2) apply_movement com guarda explícita de saldo
CREATE OR REPLACE FUNCTION public.apply_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  delta NUMERIC := 0;
  v_saldo NUMERIC;
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

  IF delta < 0 THEN
    SELECT quantidade_atual INTO v_saldo FROM public.itens WHERE id = NEW.item_id;
    IF v_saldo IS NOT NULL AND v_saldo + delta < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente: saldo atual %, tentativa de baixa de %. Estoque não pode ficar negativo.',
        v_saldo, ABS(delta)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.itens
    SET quantidade_atual = quantidade_atual + delta
    WHERE id = NEW.item_id;

  PERFORM public.refresh_item_status(NEW.item_id);

  RETURN NEW;
END; $function$;

-- 3) apply_movimentacao_item com guarda explícita de saldo
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
  v_saldo NUMERIC;
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
    IF v_new_delta < 0 THEN
      SELECT quantidade_atual INTO v_saldo FROM public.itens WHERE id = NEW.item_id;
      IF v_saldo IS NOT NULL AND v_saldo + v_new_delta < 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente: saldo atual %, tentativa de baixa de %. Estoque não pode ficar negativo.',
          v_saldo, ABS(v_new_delta)
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    UPDATE public.itens SET quantidade_atual = quantidade_atual + v_new_delta WHERE id = NEW.item_id;
    PERFORM public.refresh_item_status(NEW.item_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.itens SET quantidade_atual = quantidade_atual - v_old_delta WHERE id = OLD.item_id;
    PERFORM public.refresh_item_status(OLD.item_id);
    RETURN OLD;
  ELSE
    IF NEW.item_id = OLD.item_id THEN
      IF (v_new_delta - v_old_delta) < 0 THEN
        SELECT quantidade_atual INTO v_saldo FROM public.itens WHERE id = NEW.item_id;
        IF v_saldo IS NOT NULL AND v_saldo - v_old_delta + v_new_delta < 0 THEN
          RAISE EXCEPTION 'Estoque insuficiente: saldo atual %, ajuste resultaria em saldo negativo.',
            v_saldo
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    ELSE
      IF v_new_delta < 0 THEN
        SELECT quantidade_atual INTO v_saldo FROM public.itens WHERE id = NEW.item_id;
        IF v_saldo IS NOT NULL AND v_saldo + v_new_delta < 0 THEN
          RAISE EXCEPTION 'Estoque insuficiente: saldo atual %, tentativa de baixa de %. Estoque não pode ficar negativo.',
            v_saldo, ABS(v_new_delta)
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END IF;
    UPDATE public.itens SET quantidade_atual = quantidade_atual - v_old_delta WHERE id = OLD.item_id;
    UPDATE public.itens SET quantidade_atual = quantidade_atual + v_new_delta WHERE id = NEW.item_id;
    PERFORM public.refresh_item_status(OLD.item_id);
    IF NEW.item_id <> OLD.item_id THEN PERFORM public.refresh_item_status(NEW.item_id); END IF;
    RETURN NEW;
  END IF;
END; $function$;
