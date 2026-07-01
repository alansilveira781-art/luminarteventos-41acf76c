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
  v_default_responsavel_id uuid;
  v_default_responsavel_nome text;
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

  SELECT responsavel_id, responsavel_nome
    INTO v_default_responsavel_id, v_default_responsavel_nome
  FROM public.compras_status_defaults
  WHERE status = p_status
  LIMIT 1;

  UPDATE public.compras
  SET status = p_status,
      responsavel_id = COALESCE(v_default_responsavel_id, p_responsavel_id, responsavel_id),
      responsavel_nome = COALESCE(v_default_responsavel_nome, p_responsavel_nome, responsavel_nome)
  WHERE id = p_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.move_compra_status(uuid, public.compra_status, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_compra_status(uuid, public.compra_status, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.move_compra_status(uuid, public.compra_status, uuid, text) TO authenticated;