CREATE POLICY "patrimonio read demanda_anexos imobilizado"
ON public.demanda_anexos
FOR SELECT
TO authenticated
USING (
  has_module_access(auth.uid(), 'patrimonio')
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_anexos.demanda_id
      AND d.tipo_demanda = 'imobilizado'
  )
);