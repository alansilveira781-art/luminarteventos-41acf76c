
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS data_evento_fim date;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS data_montagem_fim date;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS data_desmontagem_fim date;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS produtor text;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS codigo_evento text;

CREATE OR REPLACE FUNCTION public.eventos_set_codigo_evento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_evento_fim IS NOT NULL AND NEW.nome IS NOT NULL THEN
    NEW.codigo_evento := to_char(NEW.data_evento_fim, 'YYYYMMDD')
      || ' - ' || upper(NEW.nome)
      || ' - ' || upper(coalesce(NEW.local, ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eventos_set_codigo_evento ON public.eventos;
CREATE TRIGGER trg_eventos_set_codigo_evento
BEFORE INSERT OR UPDATE OF data_evento_fim, nome, local ON public.eventos
FOR EACH ROW EXECUTE FUNCTION public.eventos_set_codigo_evento();

CREATE UNIQUE INDEX IF NOT EXISTS ux_eventos_codigo ON public.eventos(codigo_evento);
