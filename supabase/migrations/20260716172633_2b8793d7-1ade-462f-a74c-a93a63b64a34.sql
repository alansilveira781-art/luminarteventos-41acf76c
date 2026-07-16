
-- Compras: dono pode ler
CREATE POLICY "compras_select_owner" ON public.compras
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = solicitante_id
  OR (solicitante IS NOT NULL AND lower(solicitante) = lower((auth.jwt() ->> 'email')))
  OR (observacoes IS NOT NULL AND (auth.jwt() ->> 'email') IS NOT NULL AND observacoes ILIKE '%' || (auth.jwt() ->> 'email') || '%')
);

-- Demandas: dono pode ler
CREATE POLICY "demandas_select_owner" ON public.demandas
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = solicitante_id
  OR (solicitante IS NOT NULL AND lower(solicitante) = lower((auth.jwt() ->> 'email')))
  OR (observacoes IS NOT NULL AND (auth.jwt() ->> 'email') IS NOT NULL AND observacoes ILIKE '%' || (auth.jwt() ->> 'email') || '%')
);

-- compra_itens: leitura se dono da compra
CREATE POLICY "compra_itens_select_owner" ON public.compra_itens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.compras c
    WHERE c.id = compra_itens.compra_id
    AND (
      auth.uid() = c.created_by
      OR auth.uid() = c.solicitante_id
      OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower((auth.jwt() ->> 'email')))
      OR (c.observacoes IS NOT NULL AND (auth.jwt() ->> 'email') IS NOT NULL AND c.observacoes ILIKE '%' || (auth.jwt() ->> 'email') || '%')
    )
  )
);

-- demanda_itens: leitura se dono da demanda
CREATE POLICY "demanda_itens_select_owner" ON public.demanda_itens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_itens.demanda_id
    AND (
      auth.uid() = d.created_by
      OR auth.uid() = d.solicitante_id
      OR (d.solicitante IS NOT NULL AND lower(d.solicitante) = lower((auth.jwt() ->> 'email')))
      OR (d.observacoes IS NOT NULL AND (auth.jwt() ->> 'email') IS NOT NULL AND d.observacoes ILIKE '%' || (auth.jwt() ->> 'email') || '%')
    )
  )
);
