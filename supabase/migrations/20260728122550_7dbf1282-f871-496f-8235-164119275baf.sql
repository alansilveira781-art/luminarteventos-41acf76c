DROP POLICY IF EXISTS "compra_anexos_select_owner" ON public.compra_anexos;
CREATE POLICY "compra_anexos_select_modulo" ON public.compra_anexos
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_module_access(auth.uid(), 'compras')
  OR public.has_module_access(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_anexos.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "compra_comentarios_select" ON public.compra_comentarios;
CREATE POLICY "compra_comentarios_select" ON public.compra_comentarios
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_module_access(auth.uid(), 'compras')
  OR public.has_module_access(auth.uid(), 'estoque')
  OR EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_comentarios.compra_id
      AND (c.created_by = auth.uid() OR c.responsavel_id = auth.uid() OR c.solicitante_id = auth.uid())
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demanda_itens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demanda_anexos;