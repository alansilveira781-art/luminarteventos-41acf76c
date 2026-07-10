DROP POLICY IF EXISTS "eventos leitura publica" ON public.eventos;
CREATE POLICY "eventos leitura publica"
  ON public.eventos
  FOR SELECT
  TO anon
  USING (true);
GRANT SELECT ON public.eventos TO anon;