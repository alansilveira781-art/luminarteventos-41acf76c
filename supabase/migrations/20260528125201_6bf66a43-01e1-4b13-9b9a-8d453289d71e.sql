
ALTER TABLE public.pat_movimentacoes
  ADD COLUMN IF NOT EXISTS requisicao_numero integer;

CREATE SEQUENCE IF NOT EXISTS public.pat_requisicao_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.next_pat_requisicao_numero()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT nextval('public.pat_requisicao_numero_seq')::int $$;

GRANT EXECUTE ON FUNCTION public.next_pat_requisicao_numero() TO authenticated;
