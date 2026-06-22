-- Backfill ano/mes/trimestre fields from data_registro/data_evento when null
DO $$
BEGIN
  UPDATE public.comercial_vendas
  SET ano = EXTRACT(YEAR FROM COALESCE(data_registro, data_evento))::int
  WHERE ano IS NULL AND COALESCE(data_registro, data_evento) IS NOT NULL;

  UPDATE public.comercial_vendas
  SET ano_evento = EXTRACT(YEAR FROM COALESCE(data_evento, data_registro))::int
  WHERE ano_evento IS NULL AND COALESCE(data_evento, data_registro) IS NOT NULL;

  UPDATE public.comercial_vendas
  SET trimestre_evento = CEIL(EXTRACT(MONTH FROM COALESCE(data_evento, data_registro))::numeric / 3)::int
  WHERE trimestre_evento IS NULL AND COALESCE(data_evento, data_registro) IS NOT NULL;

  UPDATE public.comercial_vendas
  SET mes = CASE EXTRACT(MONTH FROM COALESCE(data_registro, data_evento))::int
    WHEN 1 THEN 'Janeiro' WHEN 2 THEN 'Fevereiro' WHEN 3 THEN 'Março'
    WHEN 4 THEN 'Abril' WHEN 5 THEN 'Maio' WHEN 6 THEN 'Junho'
    WHEN 7 THEN 'Julho' WHEN 8 THEN 'Agosto' WHEN 9 THEN 'Setembro'
    WHEN 10 THEN 'Outubro' WHEN 11 THEN 'Novembro' WHEN 12 THEN 'Dezembro' END
  WHERE mes IS NULL AND COALESCE(data_registro, data_evento) IS NOT NULL;

  UPDATE public.comercial_vendas
  SET mes_evento = CASE EXTRACT(MONTH FROM COALESCE(data_evento, data_registro))::int
    WHEN 1 THEN 'Janeiro' WHEN 2 THEN 'Fevereiro' WHEN 3 THEN 'Março'
    WHEN 4 THEN 'Abril' WHEN 5 THEN 'Maio' WHEN 6 THEN 'Junho'
    WHEN 7 THEN 'Julho' WHEN 8 THEN 'Agosto' WHEN 9 THEN 'Setembro'
    WHEN 10 THEN 'Outubro' WHEN 11 THEN 'Novembro' WHEN 12 THEN 'Dezembro' END
  WHERE mes_evento IS NULL AND COALESCE(data_evento, data_registro) IS NOT NULL;
END $$;

-- Enable realtime for comercial_vendas
ALTER TABLE public.comercial_vendas REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comercial_vendas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_vendas;
  END IF;
END $$;