ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS evento_pai_id uuid REFERENCES public.eventos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_eventos_evento_pai_id ON public.eventos(evento_pai_id);

CREATE OR REPLACE FUNCTION public.eventos_set_codigo_evento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_pai_codigo text;
BEGIN
  IF NEW.evento_pai_id IS NOT NULL THEN
    SELECT codigo_evento INTO v_pai_codigo FROM public.eventos WHERE id = NEW.evento_pai_id;
    IF v_pai_codigo IS NOT NULL THEN
      NEW.codigo_evento := v_pai_codigo;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.data_evento_fim IS NOT NULL AND NEW.nome IS NOT NULL THEN
    NEW.codigo_evento := to_char(NEW.data_evento_fim, 'YYYYMMDD')
      || ' - ' || upper(NEW.nome)
      || ' - ' || upper(coalesce(NEW.local, ''));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_eventos_set_codigo_evento ON public.eventos;
CREATE TRIGGER trg_eventos_set_codigo_evento
BEFORE INSERT OR UPDATE ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.eventos_set_codigo_evento();

-- Quando o evento principal muda de nome/local/data, os locais adicionais acompanham o mesmo ID
CREATE OR REPLACE FUNCTION public.eventos_sync_filhos_codigo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.evento_pai_id IS NULL AND NEW.codigo_evento IS DISTINCT FROM OLD.codigo_evento THEN
    UPDATE public.eventos SET codigo_evento = NEW.codigo_evento WHERE evento_pai_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_eventos_sync_filhos_codigo ON public.eventos;
CREATE TRIGGER trg_eventos_sync_filhos_codigo
AFTER UPDATE ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.eventos_sync_filhos_codigo();