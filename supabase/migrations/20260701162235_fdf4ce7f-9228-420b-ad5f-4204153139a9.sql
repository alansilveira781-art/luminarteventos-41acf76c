CREATE OR REPLACE FUNCTION public.validate_compra_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resp_destino uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF public.is_admin(auth.uid())
       OR public.is_module_admin(auth.uid(), 'compras') THEN
      RETURN NEW;
    END IF;

    SELECT responsavel_id INTO v_resp_destino
    FROM public.compras_status_defaults
    WHERE status = NEW.status
    LIMIT 1;

    IF v_resp_destino IS NOT NULL AND auth.uid() IS DISTINCT FROM v_resp_destino THEN
      RAISE EXCEPTION 'Apenas o responsável definido para o status "%" pode mover o card para lá.', NEW.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;