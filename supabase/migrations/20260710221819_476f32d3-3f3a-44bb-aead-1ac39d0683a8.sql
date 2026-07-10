DROP POLICY IF EXISTS "eventos leitura publica" ON public.eventos;
REVOKE SELECT ON public.eventos FROM anon;