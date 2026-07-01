
DROP POLICY IF EXISTS compras_update_owner_or_admin ON public.compras;

CREATE POLICY compras_update_owner_or_admin
ON public.compras
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_module_admin(auth.uid(), 'compras')
  OR public.is_module_admin(auth.uid(), 'estoque')
  OR public.has_module_access(auth.uid(), 'estoque')
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

CREATE OR REPLACE FUNCTION public.validate_compra_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resp_destino uuid;
  v_resp_origem uuid;
  v_next_status public.compra_status;
  v_is_pedro boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(auth.uid())
     OR public.is_module_admin(auth.uid(), 'compras') THEN
    RETURN NEW;
  END IF;

  -- Módulo estoque pode efetuar as transições do fluxo de recebimento
  IF public.has_module_access(auth.uid(), 'estoque')
     AND OLD.status = 'a_receber'::public.compra_status
     AND NEW.status IN ('finalizado'::public.compra_status, 'em_andamento'::public.compra_status) THEN
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

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.email, '')) = 'pedro123jrsergio@gmail.com'
  ) INTO v_is_pedro;

  IF v_is_pedro
     AND (
       (OLD.status = 'solicitacao'::public.compra_status AND NEW.status = 'analise'::public.compra_status)
       OR (OLD.status = 'analise'::public.compra_status AND NEW.status = 'pendente_aprovacao'::public.compra_status)
     ) THEN
    RETURN NEW;
  END IF;

  v_next_status := CASE OLD.status
    WHEN 'solicitacao'::public.compra_status THEN 'analise'::public.compra_status
    WHEN 'analise'::public.compra_status THEN 'pendente_aprovacao'::public.compra_status
    WHEN 'pendente_aprovacao'::public.compra_status THEN 'aprovada'::public.compra_status
    WHEN 'aprovada'::public.compra_status THEN 'em_andamento'::public.compra_status
    WHEN 'em_andamento'::public.compra_status THEN 'a_receber'::public.compra_status
    WHEN 'a_receber'::public.compra_status THEN 'finalizado'::public.compra_status
    ELSE NULL
  END;

  IF OLD.status = 'pendente_aprovacao'::public.compra_status THEN
    IF NEW.status IN ('aprovada'::public.compra_status, 'negada'::public.compra_status)
       AND v_resp_origem IS NOT NULL
       AND auth.uid() = v_resp_origem THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Apenas o responsável por Pendente Aprovação pode aprovar ou reprovar este card.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_next_status IS NULL OR NEW.status IS DISTINCT FROM v_next_status THEN
    RAISE EXCEPTION 'Movimentação inválida: mova o card apenas para o próximo status da sequência.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF (v_resp_origem IS NOT NULL AND auth.uid() = v_resp_origem)
     OR (v_resp_destino IS NOT NULL AND auth.uid() = v_resp_destino) THEN
    RETURN NEW;
  END IF;

  IF v_resp_origem IS NULL AND v_resp_destino IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Você não é responsável pelo status atual nem pelo próximo status deste card.'
    USING ERRCODE = 'insufficient_privilege';
END;
$function$;
