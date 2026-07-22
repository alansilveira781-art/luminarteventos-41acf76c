
CREATE OR REPLACE FUNCTION public.is_expectador_eventos(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND is_expectador_eventos = true
  )
$$;

GRANT SELECT ON public.eventos TO authenticated;

DROP POLICY IF EXISTS "Expectadores podem ver eventos" ON public.eventos;
CREATE POLICY "Expectadores podem ver eventos"
  ON public.eventos
  FOR SELECT
  TO authenticated
  USING (public.is_expectador_eventos(auth.uid()));
