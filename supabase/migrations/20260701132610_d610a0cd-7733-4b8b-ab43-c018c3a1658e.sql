CREATE OR REPLACE FUNCTION public.validate_compra_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsavel uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF public.is_admin(auth.uid())
       OR public.is_module_admin(auth.uid(), 'compras') THEN
      RETURN NEW;
    END IF;

    SELECT responsavel_id INTO v_responsavel
    FROM public.compras_status_defaults
    WHERE status = NEW.status
    LIMIT 1;

    IF v_responsavel IS NOT NULL AND auth.uid() IS DISTINCT FROM v_responsavel THEN
      RAISE EXCEPTION 'Apenas o responsável definido para o status "%" pode mover o card para lá.', NEW.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_compra_status_transition ON public.compras;

CREATE TRIGGER trg_validate_compra_status_transition
  BEFORE UPDATE ON public.compras
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_compra_status_transition();