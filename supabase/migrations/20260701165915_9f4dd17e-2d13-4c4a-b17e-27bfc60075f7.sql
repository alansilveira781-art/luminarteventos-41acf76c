CREATE OR REPLACE FUNCTION public.move_compra_status(
  p_id uuid,
  p_status public.compra_status,
  p_responsavel_id uuid DEFAULT NULL,
  p_responsavel_nome text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_atual public.compra_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status INTO v_status_atual
  FROM public.compras
  WHERE id = p_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Compra não encontrada'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF p_status IS NOT DISTINCT FROM v_status_atual THEN
    RETURN;
  END IF;

  UPDATE public.compras
  SET status = p_status,
      responsavel_id = COALESCE(p_responsavel_id, responsavel_id),
      responsavel_nome = COALESCE(p_responsavel_nome, responsavel_nome)
  WHERE id = p_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.move_compra_status(uuid, public.compra_status, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_compra_status(uuid, public.compra_status, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.move_compra_status(uuid, public.compra_status, uuid, text) TO authenticated;

DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin
ON public.compras
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR auth.uid() = created_by
  OR auth.uid() = responsavel_id
  OR auth.uid() IN (
    SELECT csd.responsavel_id
    FROM public.compras_status_defaults csd
    WHERE csd.status = compras.status
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.email, '')) = 'pedro123jrsergio@gmail.com'
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR public.has_module_access(auth.uid(), 'compras')
  OR public.has_module_access(auth.uid(), 'estoque')
);