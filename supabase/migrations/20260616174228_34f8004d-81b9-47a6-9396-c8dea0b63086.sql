
ALTER TABLE public.financeiro_rotinas
  ADD COLUMN IF NOT EXISTS max_ocorrencias integer,
  ADD COLUMN IF NOT EXISTS ocorrencias_realizadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proxima_data date,
  ADD COLUMN IF NOT EXISTS encerrada boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.calcular_proxima_data_rotina(
  p_frequencia text,
  p_dias_semana integer[],
  p_data_base date
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_next date;
  v_try date;
  i int;
BEGIN
  IF p_data_base IS NULL THEN RETURN NULL; END IF;
  CASE p_frequencia
    WHEN 'diaria' THEN
      RETURN p_data_base + INTERVAL '1 day';
    WHEN 'semanal' THEN
      RETURN p_data_base + INTERVAL '7 days';
    WHEN 'quinzenal' THEN
      RETURN p_data_base + INTERVAL '14 days';
    WHEN 'mensal' THEN
      RETURN (p_data_base + INTERVAL '1 month')::date;
    WHEN 'custom' THEN
      IF p_dias_semana IS NULL OR array_length(p_dias_semana, 1) IS NULL THEN
        RETURN p_data_base + INTERVAL '1 day';
      END IF;
      FOR i IN 1..14 LOOP
        v_try := p_data_base + (i || ' days')::interval;
        IF EXTRACT(DOW FROM v_try)::int = ANY(p_dias_semana) THEN
          RETURN v_try;
        END IF;
      END LOOP;
      RETURN p_data_base + INTERVAL '7 days';
    ELSE
      RETURN p_data_base + INTERVAL '1 day';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.primeira_data_rotina(
  p_frequencia text,
  p_dias_semana integer[],
  p_data_inicio date
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_try date;
  i int;
BEGIN
  IF p_data_inicio IS NULL THEN RETURN NULL; END IF;
  IF p_frequencia IN ('semanal', 'custom') THEN
    IF p_dias_semana IS NULL OR array_length(p_dias_semana, 1) IS NULL THEN
      RETURN p_data_inicio;
    END IF;
    FOR i IN 0..13 LOOP
      v_try := p_data_inicio + (i || ' days')::interval;
      IF EXTRACT(DOW FROM v_try)::int = ANY(p_dias_semana) THEN
        RETURN v_try;
      END IF;
    END LOOP;
  END IF;
  RETURN p_data_inicio;
END;
$$;

CREATE OR REPLACE FUNCTION public.avancar_rotina_apos_execucao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rotina public.financeiro_rotinas%ROWTYPE;
  v_proxima date;
  v_encerrada boolean := false;
BEGIN
  IF NEW.executada IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT * INTO v_rotina FROM public.financeiro_rotinas WHERE id = NEW.rotina_id;
  IF v_rotina.id IS NULL THEN RETURN NEW; END IF;

  v_proxima := public.calcular_proxima_data_rotina(
    v_rotina.frequencia::text,
    v_rotina.dias_semana,
    COALESCE(NEW.data_referencia, CURRENT_DATE)
  );

  IF v_rotina.data_fim IS NOT NULL AND v_proxima IS NOT NULL AND v_proxima > v_rotina.data_fim THEN
    v_encerrada := true;
  END IF;
  IF v_rotina.max_ocorrencias IS NOT NULL
     AND (COALESCE(v_rotina.ocorrencias_realizadas, 0) + 1) >= v_rotina.max_ocorrencias THEN
    v_encerrada := true;
  END IF;

  UPDATE public.financeiro_rotinas
     SET ocorrencias_realizadas = COALESCE(ocorrencias_realizadas, 0) + 1,
         proxima_data = CASE WHEN v_encerrada THEN proxima_data ELSE v_proxima END,
         encerrada = v_encerrada OR encerrada
   WHERE id = NEW.rotina_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avancar_rotina ON public.financeiro_rotina_execucoes;
CREATE TRIGGER trg_avancar_rotina
AFTER INSERT ON public.financeiro_rotina_execucoes
FOR EACH ROW EXECUTE FUNCTION public.avancar_rotina_apos_execucao();

-- Inicializa proxima_data para rotinas existentes (apenas onde está nula)
UPDATE public.financeiro_rotinas
   SET proxima_data = public.primeira_data_rotina(frequencia::text, dias_semana, data_inicio)
 WHERE proxima_data IS NULL;
