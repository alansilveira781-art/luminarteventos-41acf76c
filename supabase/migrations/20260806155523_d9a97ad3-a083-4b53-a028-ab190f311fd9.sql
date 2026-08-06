ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS prazo_aprovacao date;

ALTER TABLE public.compra_anexos REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_vendedores REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_cerimoniais REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_decoradores REPLICA IDENTITY FULL;
ALTER TABLE public.comercial_classificacoes REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.compra_anexos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_vendedores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_cerimoniais;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_decoradores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_classificacoes;

CREATE OR REPLACE FUNCTION public.move_compra_status(p_id uuid, p_status compra_status, p_responsavel_id uuid DEFAULT NULL::uuid, p_responsavel_nome text DEFAULT NULL::text, p_prazo date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status_atual public.compra_status;
  v_default_responsavel_id uuid;
  v_default_responsavel_nome text;
  v_prazo_anterior date;
  v_nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT (
    public.has_module_access(auth.uid(), 'compras')
    OR public.has_module_access(auth.uid(), 'estoque')
  ) THEN
    RAISE EXCEPTION 'Sem acesso ao módulo de compras'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status, prazo INTO v_status_atual, v_prazo_anterior
  FROM public.compras
  WHERE id = p_id;

  IF v_status_atual IS NULL THEN
    RAISE EXCEPTION 'Compra não encontrada'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF p_status IS NOT DISTINCT FROM v_status_atual THEN
    RETURN;
  END IF;

  IF v_status_atual = 'pendente_aprovacao'::public.compra_status
     AND p_status = 'aprovada'::public.compra_status
     AND p_prazo IS NULL THEN
    RAISE EXCEPTION 'Informe o novo prazo para a compra aprovada.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT responsavel_id, responsavel_nome
    INTO v_default_responsavel_id, v_default_responsavel_nome
  FROM public.compras_status_defaults
  WHERE status = p_status
  LIMIT 1;

  UPDATE public.compras
  SET status = p_status,
      prazo_aprovacao = CASE WHEN p_prazo IS NOT NULL THEN p_prazo ELSE prazo_aprovacao END,
      responsavel_id = COALESCE(v_default_responsavel_id, p_responsavel_id, responsavel_id),
      responsavel_nome = COALESCE(v_default_responsavel_nome, p_responsavel_nome, responsavel_nome)
  WHERE id = p_id;

  IF v_status_atual = 'pendente_aprovacao'::public.compra_status
     AND p_status = 'aprovada'::public.compra_status THEN
    SELECT display_name INTO v_nome FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.compra_historico(compra_id, user_id, user_nome, acao, status_anterior, status_novo, detalhes)
    VALUES (p_id, auth.uid(), v_nome, 'definiu_prazo', v_status_atual, p_status,
            'Prazo da fase de aprovação: ' || COALESCE(to_char(v_prazo_anterior, 'DD/MM/YYYY'), 'não informado')
            || ' · Novo prazo até finalizar: ' || to_char(p_prazo, 'DD/MM/YYYY'));
  END IF;
END;
$function$;