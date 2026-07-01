CREATE OR REPLACE FUNCTION public.validate_compra_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resp_destino uuid;
  v_resp_origem uuid;
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

    SELECT responsavel_id INTO v_resp_origem
    FROM public.compras_status_defaults
    WHERE status = OLD.status
    LIMIT 1;

    -- Responsável pelo status de origem pode empurrar para frente,
    -- e responsável pelo status de destino pode puxar.
    IF (v_resp_origem IS NOT NULL AND auth.uid() = v_resp_origem)
       OR (v_resp_destino IS NOT NULL AND auth.uid() = v_resp_destino) THEN
      RETURN NEW;
    END IF;

    -- Se nenhum dos dois está configurado, permite (compat legado).
    IF v_resp_origem IS NULL AND v_resp_destino IS NULL THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Você não é responsável pelo status "%" nem por "%". Peça para o responsável mover o card.', OLD.status, NEW.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

-- Atualiza a policy de UPDATE para permitir o responsável do status de origem também
DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin ON public.compras
FOR UPDATE
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR auth.uid() = created_by
  OR auth.uid() = responsavel_id
  OR auth.uid() IN (
    SELECT responsavel_id FROM public.compras_status_defaults WHERE status = compras.status
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR auth.uid() = created_by
  OR auth.uid() = responsavel_id
  OR auth.uid() IN (
    SELECT responsavel_id FROM public.compras_status_defaults WHERE status = compras.status
  )
);