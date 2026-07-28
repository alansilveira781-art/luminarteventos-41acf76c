CREATE OR REPLACE FUNCTION public.proximo_codigo_evento(_data date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prefixo text;
  v_max int;
  v_try text;
  i int;
BEGIN
  v_prefixo := to_char(_data, 'YYYYMM');

  SELECT COALESCE(MAX(NULLIF(regexp_replace(substring(codigo from 7), '\D', '', 'g'), '')::int), 0)
    INTO v_max
  FROM public.eventos
  WHERE codigo LIKE v_prefixo || '%';

  FOR i IN 1..999 LOOP
    v_try := v_prefixo || lpad((v_max + i)::text, 2, '0');
    IF NOT EXISTS (SELECT 1 FROM public.eventos WHERE codigo = v_try) THEN
      RETURN v_try;
    END IF;
  END LOOP;

  RETURN v_prefixo || to_char(clock_timestamp(), 'SSMS');
END;
$function$;

DROP TRIGGER IF EXISTS eventos_set_codigo_evento ON public.eventos;
CREATE TRIGGER eventos_set_codigo_evento
BEFORE INSERT OR UPDATE ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.eventos_set_codigo_evento();