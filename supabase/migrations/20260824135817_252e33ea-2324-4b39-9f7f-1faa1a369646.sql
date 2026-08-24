UPDATE public.modulos SET nome = 'Aquisições' WHERE slug = 'financeiro';

UPDATE public.financeiro_rotinas
SET dias_semana = (
  SELECT COALESCE(array_agg(d ORDER BY d), '{}')
  FROM unnest(dias_semana) AS d
  WHERE d BETWEEN 1 AND 5
)
WHERE dias_semana IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(dias_semana) AS d WHERE d IN (0, 6));

CREATE OR REPLACE FUNCTION public.proximo_dia_util(p_data date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE EXTRACT(DOW FROM p_data)::int
    WHEN 6 THEN p_data + 2
    WHEN 0 THEN p_data + 1
    ELSE p_data
  END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_proxima_data_rotina(p_frequencia text, p_dias_semana integer[], p_data_base date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_try date;
  i int;
BEGIN
  IF p_data_base IS NULL THEN RETURN NULL; END IF;
  CASE p_frequencia
    WHEN 'diaria' THEN
      RETURN public.proximo_dia_util((p_data_base + INTERVAL '1 day')::date);
    WHEN 'semanal' THEN
      RETURN public.proximo_dia_util((p_data_base + INTERVAL '7 days')::date);
    WHEN 'quinzenal' THEN
      RETURN public.proximo_dia_util((p_data_base + INTERVAL '14 days')::date);
    WHEN 'mensal' THEN
      RETURN public.proximo_dia_util((p_data_base + INTERVAL '1 month')::date);
    WHEN 'custom' THEN
      IF p_dias_semana IS NULL OR array_length(p_dias_semana, 1) IS NULL THEN
        RETURN public.proximo_dia_util((p_data_base + INTERVAL '1 day')::date);
      END IF;
      FOR i IN 1..14 LOOP
        v_try := (p_data_base + (i || ' days')::interval)::date;
        IF EXTRACT(DOW FROM v_try)::int = ANY(p_dias_semana)
           AND EXTRACT(DOW FROM v_try)::int BETWEEN 1 AND 5 THEN
          RETURN v_try;
        END IF;
      END LOOP;
      RETURN public.proximo_dia_util((p_data_base + INTERVAL '7 days')::date);
    ELSE
      RETURN public.proximo_dia_util((p_data_base + INTERVAL '1 day')::date);
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.primeira_data_rotina(p_frequencia text, p_dias_semana integer[], p_data_inicio date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_try date;
  i int;
BEGIN
  IF p_data_inicio IS NULL THEN RETURN NULL; END IF;
  IF p_frequencia IN ('semanal', 'custom') THEN
    IF p_dias_semana IS NULL OR array_length(p_dias_semana, 1) IS NULL THEN
      RETURN public.proximo_dia_util(p_data_inicio);
    END IF;
    FOR i IN 0..13 LOOP
      v_try := (p_data_inicio + (i || ' days')::interval)::date;
      IF EXTRACT(DOW FROM v_try)::int = ANY(p_dias_semana)
         AND EXTRACT(DOW FROM v_try)::int BETWEEN 1 AND 5 THEN
        RETURN v_try;
      END IF;
    END LOOP;
  END IF;
  RETURN public.proximo_dia_util(p_data_inicio);
END;
$function$;