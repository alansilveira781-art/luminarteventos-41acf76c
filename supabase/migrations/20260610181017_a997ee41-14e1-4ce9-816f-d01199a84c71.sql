DROP INDEX IF EXISTS public.comercial_vendas_uniq;
CREATE UNIQUE INDEX comercial_vendas_uniq
  ON public.comercial_vendas (nome_evento, data_evento, data_registro)
  NULLS NOT DISTINCT;