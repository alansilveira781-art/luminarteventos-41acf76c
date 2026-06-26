DROP POLICY IF EXISTS "notificacoes insert own" ON public.notificacoes;

CREATE POLICY "notificacoes insert authenticated"
ON public.notificacoes FOR INSERT
TO authenticated
WITH CHECK (true);