DROP POLICY IF EXISTS "compra-anexos read" ON storage.objects;
CREATE POLICY "compra-anexos read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compra-anexos'
  AND (
    is_admin(auth.uid())
    OR has_module_access(auth.uid(), 'compras')
    OR has_module_access(auth.uid(), 'estoque')
    OR EXISTS (
      SELECT 1 FROM public.compras c
      WHERE c.id = storage_folder_uuid(objects.name)
        AND (
          c.created_by = auth.uid()
          OR c.responsavel_id = auth.uid()
          OR c.solicitante_id = auth.uid()
          OR (c.solicitante IS NOT NULL AND lower(c.solicitante) = lower((auth.jwt() ->> 'email')))
          OR (c.solicitante_email IS NOT NULL AND lower(c.solicitante_email) = lower((auth.jwt() ->> 'email')))
        )
    )
  )
);

DROP POLICY IF EXISTS "compra-anexos insert" ON storage.objects;
CREATE POLICY "compra-anexos insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compra-anexos'
  AND (
    is_admin(auth.uid())
    OR has_module_access(auth.uid(), 'compras')
    OR has_module_access(auth.uid(), 'estoque')
    OR EXISTS (
      SELECT 1 FROM public.compras c
      WHERE c.id = storage_folder_uuid(objects.name)
        AND (
          c.created_by = auth.uid()
          OR c.responsavel_id = auth.uid()
          OR c.solicitante_id = auth.uid()
        )
    )
  )
);