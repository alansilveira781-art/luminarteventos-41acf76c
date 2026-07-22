
DROP POLICY IF EXISTS compra_itens_select_owner ON public.compra_itens;
CREATE POLICY compra_itens_select_owner ON public.compra_itens
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_itens.compra_id
      AND (
        auth.uid() = c.created_by
        OR auth.uid() = c.solicitante_id
        OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower(auth.jwt() ->> 'email'))
      )
  )
);

DROP POLICY IF EXISTS demanda_itens_select_owner ON public.demanda_itens;
CREATE POLICY demanda_itens_select_owner ON public.demanda_itens
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_itens.demanda_id
      AND (
        auth.uid() = d.created_by
        OR auth.uid() = d.solicitante_id
        OR (d.solicitante IS NOT NULL AND lower(d.solicitante) = lower(auth.jwt() ->> 'email'))
      )
  )
);
