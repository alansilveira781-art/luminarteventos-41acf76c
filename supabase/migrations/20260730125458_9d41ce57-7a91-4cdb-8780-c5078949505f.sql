CREATE OR REPLACE FUNCTION public.eventos_set_codigo_evento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.data_evento_fim IS NOT NULL AND NEW.nome IS NOT NULL THEN
    NEW.codigo_evento := to_char(NEW.data_evento_fim, 'YYYYMMDD')
      || ' - ' || upper(NEW.nome)
      || ' - ' || upper(coalesce(NEW.local, ''));

    -- Locais adicionais (registros filhos) recebem sufixo único para evitar colisão
    IF NEW.evento_pai_id IS NOT NULL THEN
      NEW.codigo_evento := NEW.codigo_evento || ' - #' || coalesce(NEW.codigo, left(NEW.id::text, 8));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;