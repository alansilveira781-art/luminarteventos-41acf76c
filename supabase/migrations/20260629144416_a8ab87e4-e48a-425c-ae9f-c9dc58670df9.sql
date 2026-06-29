
-- Tighten INSERT on notificacoes: self-only via direct table access
DROP POLICY IF EXISTS "notificacoes insert authenticated" ON public.notificacoes;
DROP POLICY IF EXISTS "notificacoes insert own" ON public.notificacoes;

CREATE POLICY "notificacoes insert self"
ON public.notificacoes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- SECURITY DEFINER RPC for cross-user notifications.
-- Any authenticated user may enqueue, but only with controlled fields and an authenticated auth.uid().
CREATE OR REPLACE FUNCTION public.enqueue_notificacoes(rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF rows IS NULL OR jsonb_typeof(rows) <> 'array' THEN
    RAISE EXCEPTION 'rows deve ser um array JSON';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    IF (r->>'user_id') IS NULL OR (r->>'titulo') IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (
      (r->>'user_id')::uuid,
      COALESCE(r->>'tipo', 'sistema'),
      LEFT(r->>'titulo', 200),
      NULLIF(LEFT(COALESCE(r->>'mensagem',''), 500), ''),
      NULLIF(r->>'link', '')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notificacoes(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notificacoes(jsonb) TO authenticated;
