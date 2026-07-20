
-- Permitir que usuários do módulo estoque leiam/atualizem demandas de tipos
-- que geram entrada no estoque, e leiam seus anexos.

CREATE POLICY "estoque read demandas recebimento"
ON public.demandas
FOR SELECT
TO authenticated
USING (
  public.has_module_access(auth.uid(), 'estoque')
  AND tipo_demanda IN ('fardamento','material_limpeza','material_escritorio','reposicao_estoque')
);

CREATE POLICY "estoque update demandas recebimento"
ON public.demandas
FOR UPDATE
TO authenticated
USING (
  public.has_module_access(auth.uid(), 'estoque')
  AND tipo_demanda IN ('fardamento','material_limpeza','material_escritorio','reposicao_estoque')
)
WITH CHECK (
  public.has_module_access(auth.uid(), 'estoque')
  AND tipo_demanda IN ('fardamento','material_limpeza','material_escritorio','reposicao_estoque')
);

CREATE POLICY "estoque read demanda_anexos recebimento"
ON public.demanda_anexos
FOR SELECT
TO authenticated
USING (
  public.has_module_access(auth.uid(), 'estoque')
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_anexos.demanda_id
      AND d.tipo_demanda IN ('fardamento','material_limpeza','material_escritorio','reposicao_estoque')
  )
);
